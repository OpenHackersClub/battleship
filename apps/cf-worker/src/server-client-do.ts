import { createStoreDoPromise } from '@livestore/adapter-cloudflare';
import type { DurableObjectState, Ai } from '@cloudflare/workers-types';
import { GAME_CONFIG } from '@battleship/domain';
import {
  processMissile,
  buildStrategyContext,
  buildAvailableTargets,
  getRandomCoordinate,
  type StrategyContext,
} from '@battleship/agent';
import { pickTargetWithAI } from './cloudflare-ai-provider';
import { Effect, LogLevel, Logger, TSemaphore } from 'effect';
import { events, schema } from '@battleship/schema';
import {
  currentGame$,
  missiles$,
  opponentShips$,
  lastAction$,
  missileResultsById$,
  allMissiles$,
  missileResults$,
} from '@battleship/schema/queries';

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

// Semaphore-based missile processing to prevent race conditions
const processMissileWithSemaphore = (
  store: ReturnType<typeof createStoreDoPromise> extends Promise<infer T> ? T : never,
  lastMissile: { id: string; x: number; y: number; player: string },
  currentGameId: string,
  myPlayer: string,
  opponentPlayer: string,
  semaphore: TSemaphore.TSemaphore
) => {
  return Effect.gen(function* () {
    return yield* TSemaphore.withPermit(semaphore)(
      Effect.gen(function* () {
        // Get opponent ships to check for collision
        const opponentShips = opponentPlayer
          ? (store as any).query(opponentShips$(currentGameId, opponentPlayer))
          : [];

        // Process missile to determine hit/miss and create result event
        const { missileResultEvent, nextPlayer } = processMissile(
          lastMissile,
          opponentShips || [],
          currentGameId,
          myPlayer,
          opponentPlayer
        );

        const lastAction = (store as any).query(lastAction$(currentGameId)) as {
          turn?: number;
        } | null;
        const missileResult = (store as any).query(
          missileResultsById$(currentGameId, lastMissile.id)
        ) as unknown[];

        yield* Effect.log('Missile result processed', LogLevel.Debug, missileResult);

        if (missileResult?.length > 0) {
          return;
        }

        const newTurn = (lastAction?.turn ?? 0) + 1;

        // Workaround issue https://github.com/livestorejs/livestore/issues/577 by committing on next tick
        // but still inside the semaphore critical section to avoid duplicates
        yield* Effect.sleep(1);
        // Fire either MissileHit or MissileMiss event based on collision result
        (store as any).commit(
          events.ActionCompleted({
            id: crypto.randomUUID(),
            gameId: currentGameId,
            player: myPlayer,
            turn: newTurn,
            nextPlayer: nextPlayer,
          }),
          missileResultEvent
        );
      })
    );
  });
};

// Fallback strategy function
const getFallbackTarget = (strategyContext: StrategyContext) => {
  const availableTargets = strategyContext.availableTargets;

  if (availableTargets.length === 0) {
    return Effect.gen(function* () {
      yield* Effect.log('🎲 No targets available for fallback strategy', LogLevel.Warning);
      return null;
    });
  }

  // Simple random selection as fallback
  const selectedTarget = getRandomCoordinate(availableTargets);
  if (selectedTarget) {
    return Effect.gen(function* () {
      yield* Effect.log(
        `🎲 Using random fallback strategy: (${selectedTarget.x}, ${selectedTarget.y})`,
        LogLevel.Info
      );
      return selectedTarget;
    });
  }
  return Effect.succeed(null);
};

// AI strategy function using Cloudflare Workers AI
const getAiTarget = (ai: Ai, strategyContext: StrategyContext) =>
  Effect.gen(function* () {
    yield* Effect.log('🌐 Using Cloudflare Workers AI strategy...', LogLevel.Info);
    return yield* pickTargetWithAI({
      context: strategyContext,
      ai: ai,
    }).pipe(
      Effect.annotateLogs({
        strategy: 'cloudflare-ai',
        model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        availableTargets: strategyContext.availableTargets.length,
        opponentHits: strategyContext.opponentHits.length,
        opponentMisses: strategyContext.opponentMisses.length,
      })
    );
  });

// Get target coordinate using AI or fallback strategy
const getTargetCoordinate = (strategyContext: StrategyContext, ai: Ai | undefined) => {
  return Effect.gen(function* () {
    if (strategyContext.availableTargets.length === 0) {
      yield* Effect.log('💡 No targets available, using fallback strategy', LogLevel.Info);
      return yield* getFallbackTarget(strategyContext).pipe(
        Effect.annotateLogs({
          strategy: 'fallback',
          reason: 'no_targets',
          availableTargets: 0,
        })
      );
    }

    // Check if AI binding is available
    if (!ai) {
      yield* Effect.log('💡 No AI binding available, using fallback strategy', LogLevel.Info);
      return yield* getFallbackTarget(strategyContext).pipe(
        Effect.annotateLogs({
          strategy: 'fallback',
          reason: 'no_ai_binding',
          availableTargets: strategyContext.availableTargets.length,
        })
      );
    }

    yield* Effect.log('🌐 Using Cloudflare AI strategy for target selection', LogLevel.Info);
    return yield* Effect.catchAll(getAiTarget(ai, strategyContext), () => {
      return Effect.gen(function* () {
        yield* Effect.log(
          '⚠️ Cloudflare AI strategy failed, falling back to random strategy',
          LogLevel.Warning
        );
        return yield* getFallbackTarget(strategyContext).pipe(
          Effect.annotateLogs({
            strategy: 'fallback',
            reason: 'cloudflare_ai_failed',
            availableTargets: strategyContext.availableTargets.length,
          })
        );
      });
    });
  });
};

const agentTurn = (
  store: ReturnType<typeof createStoreDoPromise> extends Promise<infer T> ? T : never,
  currentGame: { id: string; currentTurn: number },
  myPlayer: string,
  opponentPlayer: string,
  semaphore: TSemaphore.TSemaphore,
  ai: Ai | undefined
): Effect.Effect<void, unknown, never> => {
  return Effect.gen(function* () {
    const gameId = currentGame.id;

    // Get all missiles fired in this game to avoid duplicates
    const allFiredMissiles =
      ((store as any).query(allMissiles$(gameId)) as Array<{ x: number; y: number }>) || [];
    const firedCoordinates = new Set<string>(
      allFiredMissiles.map((missile) => `${missile.x},${missile.y}`)
    );

    // Log agent turn start
    yield* Effect.log(
      `🤖 Agent turn for player: ${myPlayer}, turn: ${currentGame.currentTurn}`,
      LogLevel.Info
    );
    yield* Effect.log(`Already fired at: ${firedCoordinates.size} locations`, LogLevel.Debug);

    // Build available targets list
    const availableTargets = buildAvailableTargets(firedCoordinates, GAME_CONFIG);

    // Get opponent missile results
    const opponentMissileResults =
      ((store as any).query(missileResults$(gameId, opponentPlayer)) as Array<{
        id: string;
        x: number;
        y: number;
        player: string;
        isHit: boolean;
      }>) || [];

    // Build strategy context for AI analysis
    const strategyContext = buildStrategyContext(opponentMissileResults, availableTargets);

    // Log game state analysis
    yield* Effect.log('🧠 AI analyzing game state', LogLevel.Info);
    yield* Effect.log('Game state details', LogLevel.Debug, {
      opponentHits: strategyContext.opponentHits.length,
      opponentMisses: strategyContext.opponentMisses.length,
      availableTargets: strategyContext.availableTargets.length,
    });

    // Get target coordinate using Cloudflare AI or fallback strategy
    const coordinate = yield* getTargetCoordinate(strategyContext, ai).pipe(
      Effect.withLogSpan('strategy_selection'),
      Effect.annotateLogs({
        gameId: gameId,
        player: myPlayer,
        opponentPlayer: opponentPlayer,
        gridSize: `${strategyContext.gridSize.rowSize}x${strategyContext.gridSize.colSize}`,
      }),
      Effect.provide(Logger.pretty)
    );

    if (!coordinate) {
      yield* Effect.log('🤖 No available cells to fire at', LogLevel.Warning);
      return;
    }

    yield* Effect.log(
      `🎯 Strategy selected target: (${coordinate.x}, ${coordinate.y})`,
      LogLevel.Info
    );

    // Create missile
    const missileId = crypto.randomUUID();
    const missile = {
      id: missileId,
      gameId: gameId,
      player: myPlayer,
      x: coordinate.x,
      y: coordinate.y,
      createdAt: new Date(),
    };

    // Add a small delay to ensure the missile is processed before we check results
    yield* Effect.sleep(100);

    // Fire the missile first
    (store as any).commit(events.MissileFired(missile));

    // Process the missile using the same semaphore used for player actions
    yield* processMissileWithSemaphore(
      store,
      missile,
      gameId,
      myPlayer,
      opponentPlayer,
      semaphore
    );

    // Log turn completion
    yield* Effect.log('🤖 AI Agent turn completed', LogLevel.Info);
  }).pipe(
    Effect.catchAll((error) =>
      Effect.log('🚨 Agent turn failed completely', LogLevel.Error, error)
    ),
    Effect.provide(Logger.pretty)
  );
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
      ctx: context as unknown as Parameters<
        typeof createStoreDoPromise
      >[0]['durableObject']['ctx'],
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
    Effect.log(`Server started - Sync URL: ${LIVESTORE_SYNC_URL}, Port: ${PORT}`, LogLevel.Info).pipe(
      Effect.provide(Logger.pretty)
    )
  );

  (store as unknown as { subscribe: (query: unknown, options: unknown) => () => void }).subscribe(
    currentGame$(),
    {
      skipInitialRun: false,
      onUpdate: async (currentGame: {
        id: string;
        players: string[];
        currentPlayer: string;
        currentTurn: number;
      } | null) => {
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
        const myPlayer = players[0]; // Assuming first player is the current player
        const opponentPlayer = players[1];

        await Effect.runPromise(
          Effect.log(
            `Start listening to missiles - Game: ${currentGameId}, Player: ${myPlayer}, Opponent: ${opponentPlayer}`,
            LogLevel.Info
          ).pipe(Effect.provide(Logger.pretty))
        );

        // Listen to MissileFired events for all players
        const unsubscribeMissiles = (
          store as unknown as { subscribe: (query: unknown, options: unknown) => () => void }
        ).subscribe(missiles$(currentGameId, myPlayer), {
          skipInitialRun: false,

          onSubscribe: async () => {
            await Effect.runPromise(
              Effect.log('Subscribed to missiles', LogLevel.Debug).pipe(
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
                  `🚀 Missiles fired: ${missiles.length}, myPlayer: ${myPlayer}`,
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
                `Missile details - ID: ${lastMissile.id}, Position: (${missiles?.[0]?.x}, ${missiles?.[0]?.y})`,
                LogLevel.Debug
              ).pipe(Effect.provide(Logger.pretty))
            );

            console.log('missile', lastMissile.id, missiles?.[0]?.x, missiles?.[0]?.y);

            if (!freshGame || lastMissile.player !== freshGame.currentPlayer) {
              console.log('missile fired out of turn', lastMissile.player, freshGame?.currentPlayer);
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
                processMissileWithSemaphore(
                  store,
                  lastMissile,
                  currentGameId,
                  myPlayer,
                  opponentPlayer,
                  missileProcessingSemaphore
                ) as Effect.Effect<void, unknown, never>
              ).pipe(Effect.provide(Logger.pretty))
            );
          },
        });

        // Could live in another client
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
                yield* Effect.log(`Next player: ${game?.currentPlayer}`, LogLevel.Info);
              }).pipe(Effect.provide(Logger.pretty))
            );

            if (game?.currentPlayer === 'player-2') {
              // Run agent turn asynchronously without blocking
              await Effect.runPromise(
                (
                  agentTurn(
                    store,
                    { id: game.id, currentTurn: game.currentTurn },
                    'player-2',
                    'player-1',
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

        unsubscribeHandlers.push(unsubscribeMissiles, unsubscribeLastAction);
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
