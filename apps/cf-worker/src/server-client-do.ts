import { agentTurn, processMissileWithSemaphore, type StoreAdapter } from '@battleship/agent';
import { events, schema } from '@battleship/schema';
import {
  currentGame$,
  lastAction$,
  missileResultsById$,
  missiles$,
} from '@battleship/schema/queries';
import type { Ai, DurableObjectState } from '@cloudflare/workers-types';
import { createStoreDoPromise } from '@livestore/adapter-cloudflare';
import { Effect, Logger, LogLevel, TSemaphore } from 'effect';
import { CloudflareAgentAIProvider } from './cloudflare-ai-provider';
import { CloudflareStoreAdapter } from './store-adapter-cloudflare';

// Environment configuration
const ENV = {
  LIVESTORE_SYNC_URL:
    (globalThis as unknown as { process?: { env?: { VITE_LIVESTORE_SYNC_URL?: string } } })?.process
      ?.env?.VITE_LIVESTORE_SYNC_URL || 'ws://localhost:8787',
  PORT:
    Number(
      (globalThis as unknown as { process?: { env?: { VITE_SERVER_PORT?: string } } })?.process?.env
        ?.VITE_SERVER_PORT
    ) || 10000,
  STORE_ID: (globalThis as unknown as { process?: { env?: { VITE_STORE_ID?: string } } })?.process
    ?.env?.VITE_STORE_ID,
};

const LIVESTORE_SYNC_URL = ENV.LIVESTORE_SYNC_URL;
const PORT = ENV.PORT;

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

const main = async (context: DurableObjectState, env: Env) => {
  const storeId = ENV.STORE_ID;
  if (!storeId) {
    throw new Error(
      'VITE_STORE_ID is not set in env variables. Configure same store id across all clients'
    );
  }

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
    syncBackendStub: env.WEBSOCKET_SERVER?.get(env.WEBSOCKET_SERVER.idFromName(storeId)),
  } as Parameters<typeof createStoreDoPromise>[0]);

  await new Promise((resolve) => setTimeout(resolve, 5 * 1000));

  let lastGameId = '';
  let unsubscribeHandlers: (() => void)[] = [];

  // Create a semaphore (1 permit) for missile processing to prevent race conditions
  const missileProcessingSemaphore = await Effect.runPromise(TSemaphore.make(1));

  // Log server start with Effect
  await Effect.runPromise(
    Effect.log(
      `Server started - Sync URL: ${LIVESTORE_SYNC_URL}, Port: ${PORT}`,
      LogLevel.Info
    ).pipe(Effect.provide(Logger.pretty))
  );

  (store as unknown as { subscribe: (query: unknown, options: unknown) => () => void }).subscribe(
    currentGame$(),
    {
      skipInitialRun: false,
      onUpdate: async (
        currentGame: {
          id: string;
          players: string[];
          currentPlayer: string;
          currentTurn: number;
        } | null
      ) => {
        await Effect.runPromise(
          Effect.gen(function* () {
            yield* Effect.log(`Server Store Id: ${store.storeId}`, LogLevel.Debug);
            yield* Effect.log('Current game updated', LogLevel.Debug, currentGame);
          }).pipe(Effect.provide(Logger.pretty))
        );

        if (!currentGame) {
          return;
        }
        // onUpdate trigger on player update thus infinite loop
        if (lastGameId === currentGame.id) {
          return;
        }

        await Effect.runPromise(
          Effect.log('Unsubscribing listeners', LogLevel.Debug).pipe(Effect.provide(Logger.pretty))
        );
        for (const unsubscribe of unsubscribeHandlers) {
          unsubscribe?.();
        }
        unsubscribeHandlers = [];
        lastGameId = currentGame.id;

        const currentGameId = currentGame.id;
        const players = currentGame.players;
        const player1 = players[0];
        const player2 = players[1];

        await Effect.runPromise(
          Effect.log(
            `Start listening to missiles - Game: ${currentGameId}, Player1: ${player1}, Player2: ${player2}`,
            LogLevel.Info
          ).pipe(Effect.provide(Logger.pretty))
        );

        // Helper function to create missile subscription for a player
        const createMissileSubscription = (currentPlayer: string, opponent: string) => {
          return (
            store as unknown as { subscribe: (query: unknown, options: unknown) => () => void }
          ).subscribe(missiles$(currentGameId, currentPlayer), {
            skipInitialRun: false,

            onSubscribe: async () => {
              await Effect.runPromise(
                Effect.log(`Subscribed to missiles for ${currentPlayer}`, LogLevel.Debug).pipe(
                  Effect.provide(Logger.pretty)
                )
              );
            },
            onUpdate: async (
              missiles: Array<{ id: string; x: number; y: number; player: string }>
            ) => {
              // Get fresh game state to check current player
              const freshGame = (store as any).query(currentGame$()) as {
                id: string;
                currentPlayer: string;
              } | null;

              await Effect.runPromise(
                Effect.gen(function* () {
                  yield* Effect.log(
                    `🚀 Missiles fired by ${currentPlayer}: ${missiles.length}`,
                    LogLevel.Info
                  );
                  yield* Effect.log('Current game state', LogLevel.Debug, freshGame);
                }).pipe(Effect.provide(Logger.pretty))
              );

              if (missiles.length <= 0) {
                return;
              }

              const lastMissile = missiles?.[0];

              await Effect.runPromise(
                Effect.log(
                  `Missile details - ID: ${lastMissile.id}, Position: (${missiles?.[0]?.x}, ${missiles?.[0]?.y}), Player: ${lastMissile.player}`,
                  LogLevel.Debug
                ).pipe(Effect.provide(Logger.pretty))
              );

              console.log(
                'missile',
                lastMissile.id,
                missiles?.[0]?.x,
                missiles?.[0]?.y,
                lastMissile.player
              );

              if (!freshGame || lastMissile.player !== freshGame.currentPlayer) {
                console.log(
                  'missile fired out of turn',
                  lastMissile.player,
                  freshGame?.currentPlayer
                );
                return;
              }

              // Check if missile result already exists
              const missileResult = (store as any).query(
                missileResultsById$(currentGameId, lastMissile.id)
              ) as unknown[];

              console.log('missile result', missileResult);

              if (missileResult?.length > 0) {
                return;
              }

              // Process missile with semaphore to prevent race conditions
              await Effect.runPromise(
                (
                  processMissileWithStore(
                    store,
                    lastMissile,
                    currentGameId,
                    currentPlayer,
                    opponent,
                    missileProcessingSemaphore
                  ) as Effect.Effect<void, unknown, never>
                ).pipe(Effect.provide(Logger.pretty))
              );
            },
          });
        };

        // Subscribe to missiles from both players
        const unsubscribeMissilesPlayer1 = createMissileSubscription(player1, player2);
        const unsubscribeMissilesPlayer2 = createMissileSubscription(player2, player1);

        // Could live in another client - AI agent is always player2
        const agentPlayer = player2;
        const humanPlayer = player1;

        const unsubscribeLastAction = (
          store as unknown as { subscribe: (query: unknown, options: unknown) => () => void }
        ).subscribe(lastAction$(currentGameId), {
          onUpdate: async () => {
            // Get fresh game state to check current player and turn
            const game = (store as any).query(currentGame$()) as {
              id: string;
              currentPlayer: string;
              currentTurn: number;
            } | null;

            await Effect.runPromise(
              Effect.gen(function* () {
                yield* Effect.log(
                  `Next player: ${game?.currentPlayer}, Agent is: ${agentPlayer}`,
                  LogLevel.Info
                );
              }).pipe(Effect.provide(Logger.pretty))
            );

            if (game?.currentPlayer === agentPlayer) {
              // Run agent turn asynchronously without blocking
              await Effect.runPromise(
                (
                  runAgentTurn(
                    store,
                    { id: game.id, currentTurn: game.currentTurn },
                    agentPlayer,
                    humanPlayer,
                    missileProcessingSemaphore,
                    env.AI
                  ) as Effect.Effect<void, unknown, never>
                ).pipe(Effect.provide(Logger.pretty))
              ).catch(async (error) => {
                await Effect.runPromise(
                  Effect.log('Agent turn failed', LogLevel.Error, error).pipe(
                    Effect.provide(Logger.pretty)
                  )
                );
              });
            }
          },
        });

        unsubscribeHandlers.push(
          unsubscribeMissilesPlayer1,
          unsubscribeMissilesPlayer2,
          unsubscribeLastAction
        );
      },
    }
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
export class ServerClientDO {
  constructor(
    private state: DurableObjectState,
    private env: Env
  ) {}

  async fetch(_request: Request): Promise<Response> {
    // Initialize on first request
    if (!this.initialized) {
      await this.initialize();
    }
    return new Response('Server Client DO', { status: 200 });
  }

  private initialized = false;

  private async initialize() {
    await main(this.state, this.env);
    this.initialized = true;
  }
}
