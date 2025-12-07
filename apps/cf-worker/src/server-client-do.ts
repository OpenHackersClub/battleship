import { agentTurn, processMissileWithSemaphore, type StoreAdapter } from '@battleship/agent';
import { events, schema } from '@battleship/schema';
import {
  currentGame$,
  lastAction$,
  missileResultsById$,
  missiles$,
} from '@battleship/schema/queries';
import type { Ai } from '@cloudflare/workers-types';
import { DurableObject } from 'cloudflare:workers';
import { createStoreDoPromise, type ClientDoWithRpcCallback } from '@livestore/adapter-cloudflare';
import { handleSyncUpdateRpc } from '@livestore/sync-cf/client';
import { Effect, TSemaphore } from 'effect';
import { CloudflareAgentAIProvider } from './cloudflare-ai-provider';
import { CloudflareStoreAdapter } from './store-adapter-cloudflare';

// Default configuration
const DEFAULT_SYNC_URL = 'ws://localhost:10000/sync';
const DEFAULT_PORT = 10000;

// Helper type for Livestore instance
type LiveStoreInstance = ReturnType<typeof createStoreDoPromise> extends Promise<infer T>
  ? T
  : never;

/**
 * Helper function to process a missile using the store adapter.
 * This wraps the platform-agnostic processMissileWithSemaphore with Cloudflare-specific store.
 */
const processMissileWithStore = (
  store: LiveStoreInstance,
  lastMissile: { id: string; x: number; y: number; player: string },
  currentGameId: string,
  myPlayer: string,
  opponentPlayer: string,
  semaphore: TSemaphore.TSemaphore
) => {
  const storeAdapter = new CloudflareStoreAdapter(store);
  return processMissileWithSemaphore(
    storeAdapter,
    lastMissile,
    currentGameId,
    myPlayer,
    opponentPlayer,
    semaphore
  );
};

/**
 * Run agent turn using the refactored agent package.
 * This creates the appropriate adapters for Cloudflare Workers environment.
 */
const runAgentTurn = (
  store: LiveStoreInstance,
  currentGame: { id: string; currentTurn: number },
  myPlayer: string,
  opponentPlayer: string,
  semaphore: TSemaphore.TSemaphore,
  ai: Ai | undefined
) => {
  const storeAdapter = new CloudflareStoreAdapter(store);
  const aiProvider = ai ? new CloudflareAgentAIProvider(ai) : undefined;

  return agentTurn({
    store: storeAdapter,
    currentGame: {
      id: currentGame.id,
      currentTurn: currentGame.currentTurn,
      currentPlayer: myPlayer,
      players: [myPlayer, opponentPlayer],
    },
    myPlayer,
    opponentPlayer,
    semaphore,
    aiProvider,
  });
};

const main = async (context: DurableObjectState, env: Env, storeId: string) => {
  console.log('[ServerClientDO] main() started');
  console.log('[ServerClientDO] storeId:', storeId);

  // Check if WEBSOCKET_SERVER binding exists
  if (!env.WEBSOCKET_SERVER) {
    console.error('[ServerClientDO] ERROR: WEBSOCKET_SERVER binding is not defined!');
    throw new Error('WEBSOCKET_SERVER binding is required');
  }

  const syncBackendId = env.WEBSOCKET_SERVER.idFromName(storeId);
  console.log('[ServerClientDO] Sync backend DO ID:', syncBackendId.toString());
  const syncBackendStub = env.WEBSOCKET_SERVER.get(syncBackendId);
  console.log('[ServerClientDO] Got sync backend stub');

  console.log('[ServerClientDO] Creating store...');
  // Create store using Durable Object adapter
  const store = await createStoreDoPromise({
    schema,
    storeId,
    clientId: 'server-client',
    sessionId: 'server-client-session',
    durableObject: {
      ctx: context as unknown as Parameters<typeof createStoreDoPromise>[0]['durableObject']['ctx'],
      env: env,
      bindingName: 'SERVER_CLIENT_DO',
    },
    syncBackendStub,
    livePull: true, // Enable live updates via DO RPC callbacks
  } as Parameters<typeof createStoreDoPromise>[0]);
  console.log('[ServerClientDO] Store created successfully');
  console.log('[ServerClientDO] Store internals:', Object.keys(store));

  // Remove the arbitrary 5-second delay - subscriptions should be set up immediately
  console.log('[ServerClientDO] Setting up subscriptions...');

  // Debug: Set up a simple interval to check for changes
  setInterval(() => {
    const game = (store as any).query(currentGame$());
    const missiles = game ? (store as any).query(missiles$(game.id, 'player-1')) : [];
    console.log(`[ServerClientDO] Polling check - Game turn: ${game?.currentTurn}, Player1 missiles: ${missiles?.length || 0}`);
  }, 5000);

  let lastGameId = '';
  let unsubscribeHandlers: (() => void)[] = [];

  // Create a semaphore (1 permit) for missile processing to prevent race conditions
  const missileProcessingSemaphore = await Effect.runPromise(TSemaphore.make(1));

  console.log(`[ServerClientDO] Server started - Sync URL: ${DEFAULT_SYNC_URL}, Port: ${DEFAULT_PORT}`);

  // Debug: Query current game directly before subscribing
  const initialGame = (store as any).query(currentGame$());
  console.log('[ServerClientDO] Initial game query result:', JSON.stringify(initialGame));

  // Subscribe to current game - callback is the second argument, options is the third
  const unsubscribeCurrentGame = (store as any).subscribe(
    currentGame$(),
    async (currentGame: {
      id: string;
      players: string[];
      currentPlayer: string;
      currentTurn: number;
    } | null) => {
      console.log('[ServerClientDO] onUpdate called with:', JSON.stringify(currentGame));
      console.log(`[ServerClientDO] Server Store Id: ${store.storeId}`);
      console.log(`[ServerClientDO] Current game updated: ${JSON.stringify(currentGame)}`);

      if (!currentGame) {
        return;
      }
      // onUpdate trigger on player update thus infinite loop
      if (lastGameId === currentGame.id) {
        return;
      }

      console.log('[ServerClientDO] Unsubscribing listeners');
      for (const unsubscribe of unsubscribeHandlers) {
        unsubscribe?.();
      }
      unsubscribeHandlers = [];
      lastGameId = currentGame.id;

      const currentGameId = currentGame.id;
      const players = currentGame.players;
      const player1 = players[0];
      const player2 = players[1];

      console.log(`[ServerClientDO] Start listening to missiles - Game: ${currentGameId}, Player1: ${player1}, Player2: ${player2}`);

      // Helper function to create missile subscription for a player
      const createMissileSubscription = (currentPlayer: string, opponent: string) => {
        return (store as any).subscribe(
          missiles$(currentGameId, currentPlayer),
          async (missiles: Array<{ id: string; x: number; y: number; player: string }>) => {
            // Get fresh game state to check current player
            const freshGame = (store as any).query(currentGame$()) as {
              id: string;
              currentPlayer: string;
            } | null;

            console.log(`[ServerClientDO] 🚀 Missiles fired by ${currentPlayer}: ${missiles.length}`);

            if (missiles.length <= 0) {
              return;
            }

            const lastMissile = missiles?.[0];

            console.log(`[ServerClientDO] Missile details - ID: ${lastMissile.id}, Position: (${lastMissile.x}, ${lastMissile.y}), Player: ${lastMissile.player}`);

            if (!freshGame || lastMissile.player !== freshGame.currentPlayer) {
              return;
            }

            // Check if missile result already exists
            const missileResult = (store as any).query(
              missileResultsById$(currentGameId, lastMissile.id)
            ) as unknown[];

            if (missileResult?.length > 0) {
              return;
            }

            // Process missile with semaphore to prevent race conditions
            console.log(`[ServerClientDO] Processing missile ${lastMissile.id}...`);
            await Effect.runPromise(
              processMissileWithStore(
                store,
                lastMissile,
                currentGameId,
                currentPlayer,
                opponent,
                missileProcessingSemaphore
              ) as Effect.Effect<void, unknown, never>
            );
            console.log(`[ServerClientDO] Missile ${lastMissile.id} processed`);
          },
          { skipInitialRun: false }
        );
      };

      // Subscribe to missiles from both players
      const unsubscribeMissilesPlayer1 = createMissileSubscription(player1, player2);
      const unsubscribeMissilesPlayer2 = createMissileSubscription(player2, player1);

      // Could live in another client - AI agent is always player2
      const agentPlayer = player2;
      const humanPlayer = player1;

      const unsubscribeLastAction = (store as any).subscribe(
        lastAction$(currentGameId),
        async () => {
          // Get fresh game state to check current player and turn
          const game = (store as any).query(currentGame$()) as {
            id: string;
            currentPlayer: string;
            currentTurn: number;
          } | null;

          console.log(`[ServerClientDO] Next player: ${game?.currentPlayer}, Agent is: ${agentPlayer}`);

          if (game?.currentPlayer === agentPlayer) {
            // Run agent turn asynchronously without blocking
            console.log(`[ServerClientDO] Running agent turn...`);
            await Effect.runPromise(
              runAgentTurn(
                store,
                { id: game.id, currentTurn: game.currentTurn },
                agentPlayer,
                humanPlayer,
                missileProcessingSemaphore,
                env.AI
              ) as Effect.Effect<void, unknown, never>
            ).catch((error) => {
              console.error('[ServerClientDO] Agent turn failed:', error);
            });
            console.log(`[ServerClientDO] Agent turn complete`);
          }
        }
      );

      unsubscribeHandlers.push(
        unsubscribeMissilesPlayer1,
        unsubscribeMissilesPlayer2,
        unsubscribeLastAction
      );
    },
    { skipInitialRun: false }
  );
};

// Environment type definition
interface Env {
  AI?: Ai;
  SERVER_CLIENT_DO: DurableObjectNamespace;
  WEBSOCKET_SERVER: DurableObjectNamespace;
  DB?: D1Database;
}

// Durable Object class for server-client
// Extends DurableObject to enable RPC calls between DOs
// Implements ClientDoWithRpcCallback to receive live sync updates via DO RPC
export class ServerClientDO extends DurableObject<Env> implements ClientDoWithRpcCallback {
  // Required brand for type checking (never actually used at runtime)
  declare __DURABLE_OBJECT_BRAND: never;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const storeId = url.searchParams.get('storeId');

    // Initialize on first request with a valid storeId
    if (!this.initialized && storeId) {
      await this.initialize(storeId);
    }
    return new Response('Server Client DO', { status: 200 });
  }

  /**
   * RPC callback method called by the sync backend (WebSocketServer DO) to push updates.
   * This is how livePull: true works - the sync backend calls this method on this DO
   * whenever there are new events to sync.
   */
  async syncUpdateRpc(payload: unknown): Promise<void> {
    console.log('[ServerClientDO] Received sync update via RPC callback');
    try {
      await handleSyncUpdateRpc(payload);
      console.log('[ServerClientDO] Sync update processed successfully');
    } catch (error) {
      console.error('[ServerClientDO] Error processing sync update:', error);
      // Don't rethrow - we want the sync to continue even if processing fails
    }
  }

  private initialized = false;

  private async initialize(storeId: string) {
    console.log('[ServerClientDO] Starting initialization...');
    try {
      // this.ctx is provided by DurableObject base class (the state)
      // this.env is provided by DurableObject base class (the environment)
      await main(this.ctx, this.env, storeId);
      this.initialized = true;
      console.log('[ServerClientDO] Initialization complete');
    } catch (error) {
      console.error('[ServerClientDO] Initialization failed:', error);
      throw error;
    }
  }
}
