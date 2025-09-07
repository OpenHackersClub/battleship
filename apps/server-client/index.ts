import { makeAdapter } from '@livestore/adapter-node';
import { createStorePromise } from '@livestore/livestore';
import { makeCfSync } from '@livestore/sync-cf';
import {
  GAME_CONFIG,
  getMissileHitPosition,
  type StrategyContext,
  type MissileResult,
} from '@battleship/domain';
import { pickTargetWithAI } from './strategy';
import * as OpenAiLanguageModel from '@effect/ai-openai/OpenAiLanguageModel';
import * as OpenAiClient from '@effect/ai-openai/OpenAiClient';
import { HttpServer, HttpRouter, HttpServerResponse } from '@effect/platform';
import { NodeHttpClient } from '@effect/platform-node';
import { Effect, Option, LogLevel, Logger, Redacted, TSemaphore } from 'effect';
import { listen } from './server';
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
    (globalThis as any)?.process?.env?.VITE_LIVESTORE_SYNC_URL || 'ws://localhost:8787',
  PORT: Number((globalThis as any)?.process?.env?.VITE_SERVER_PORT) || 10000,
  STORE_ID: (globalThis as any)?.process?.env?.VITE_STORE_ID,
};

const LIVESTORE_SYNC_URL = ENV.LIVESTORE_SYNC_URL;
const PORT = ENV.PORT;

// Config definitions for Effect (if needed in the future)
// const OPENAI_API_KEY_CONFIG = Config.redacted('VITE_OPENAI_API_KEY');

// Using Effect's built-in pretty logger directly

// Semaphore-based missile processing to prevent race conditions
const processMissileWithSemaphore = (
  store: any,
  lastMissile: any,
  currentGameId: string,
  myPlayer: string,
  opponentPlayer: string,
  semaphore: TSemaphore.TSemaphore
) => {
  return Effect.gen(function* () {
    return yield* TSemaphore.withPermit(semaphore)(
      Effect.gen(function* () {
        // Process missile to determine hit/miss and create result event
        const { missileResultEvent, nextPlayer } = processMissile(
          store,
          lastMissile,
          currentGameId,
          myPlayer,
          opponentPlayer
        );

        const lastAction = store.query(lastAction$(currentGameId)) as any;
        const missileResult = store.query(
          missileResultsById$(currentGameId, lastMissile.id)
        ) as any[];

        yield* Effect.log('Missile result processed', LogLevel.Debug, missileResult);

        if (missileResult?.length > 0) {
          return;
        }

        const newTurn = (lastAction?.turn ?? 0) + 1;

        // Workaround issue https://github.com/livestorejs/livestore/issues/577 by committing on next tick
        // but still inside the semaphore critical section to avoid duplicates
        yield* Effect.sleep(1);
        // Fire either MissileHit or MissileMiss event based on collision result
        store.commit(
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

// TODO fix to use schema types
/**
 * Processes a missile and determines if it hits or misses opponent ships
 * @param store - The livestore instance
 * @param missile - The missile object to process
 * @param gameId - The current game ID
 * @param currentPlayer - The player who fired the missile
 * @param opponentPlayer - The opponent player
 * @returns Object containing hit result, missile result event, and next player
 */
const processMissile = (
  store: any,
  missile: any,
  gameId: string,
  currentPlayer: string,
  opponentPlayer: string
) => {
  // Get opponent ships to check for collision
  const opponentShips = opponentPlayer ? store.query(opponentShips$(gameId, opponentPlayer)) : [];

  // Check for collision using shared missile processing utilities
  const hitPosition = getMissileHitPosition(missile, opponentShips || []);
  const isHit = hitPosition !== undefined;

  // Log collision result with Effect (this will be handled by the calling context)
  // Note: This is a synchronous function, so we'll log at the call site

  // Create appropriate missile result event
  const missileResultEvent = isHit
    ? events.MissileHit({
        id: missile.id,
        gameId: gameId,
        x: missile.x,
        y: missile.y,
        player: currentPlayer,
        createdAt: new Date(),
      })
    : events.MissileMiss({
        id: missile.id,
        gameId: gameId,
        x: missile.x,
        y: missile.y,
        player: currentPlayer,
        createdAt: new Date(),
      });

  // Determine next player (if hit, current player gets another turn)
  const nextPlayer = isHit ? currentPlayer : opponentPlayer;

  return {
    isHit,
    hitPosition,
    missileResultEvent,
    nextPlayer,
  };
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
  const randomIndex = Math.floor(Math.random() * availableTargets.length);
  const selectedTarget = availableTargets[randomIndex];
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

// Build strategy context from game state data
const buildStrategyContext = (
  store: any,
  gameId: string,
  _myPlayer: string,
  opponentPlayer: string,
  availableTargets: { x: number; y: number }[]
): StrategyContext => {
  // Get opponent missile results with hit/miss information
  const opponentMissileResults = store.query(missileResults$(gameId, opponentPlayer)) || [];

  // Convert to the format expected by the AI strategy
  const opponentHits: MissileResult[] = opponentMissileResults
    .filter((result: any) => result.isHit)
    .map((result: any) => ({
      id: result.id,
      x: result.x,
      y: result.y,
      player: result.player,
    }));

  const opponentMisses: MissileResult[] = opponentMissileResults
    .filter((result: any) => !result.isHit)
    .map((result: any) => ({
      id: result.id,
      x: result.x,
      y: result.y,
      player: result.player,
    }));

  return {
    gridSize: {
      rowSize: GAME_CONFIG.rowSize,
      colSize: GAME_CONFIG.colSize,
    },
    availableTargets,
    opponentHits,
    opponentMisses,
  };
};

// AI strategy function
const getAiTarget = (
  apiKey: any,
  strategyContext: StrategyContext,
  aiPlayerType: 'openai' | 'browserai'
) =>
  Effect.gen(function* () {
    if (aiPlayerType === 'browserai') {
      yield* Effect.log('🧠 Using fallback strategy for Browser AI on server...', LogLevel.Info);
      // Browser AI should run on client side, not server side
      // This is a fallback for server-side processing
      return yield* getFallbackTarget(strategyContext).pipe(
        Effect.annotateLogs({
          strategy: 'fallback',
          aiPlayerType: 'browserai',
          reason: 'browser_ai_on_server',
          availableTargets: strategyContext.availableTargets.length,
          opponentHits: strategyContext.opponentHits.length,
          opponentMisses: strategyContext.opponentMisses.length,
        })
      );
    } else {
      yield* Effect.log('🌐 Using OpenAI-powered strategy...', LogLevel.Info);
      return yield* pickTargetWithAI({
        context: strategyContext,
        apiKey: apiKey,
        model: 'gpt-4o-mini',
      }).pipe(
        Effect.annotateLogs({
          strategy: 'openai',
          model: 'gpt-4o-mini',
          availableTargets: strategyContext.availableTargets.length,
          opponentHits: strategyContext.opponentHits.length,
          opponentMisses: strategyContext.opponentMisses.length,
        })
      );
    }
  });

// Get target coordinate using AI or fallback strategy
const getTargetCoordinate = (
  strategyContext: StrategyContext,
  apiKey: string,
  aiPlayerType: 'openai' | 'browserai' = 'openai'
) => {
  return Effect.gen(function* () {
    if (strategyContext.availableTargets.length === 0) {
      yield* Effect.log('💡 No targets available, using fallback strategy', LogLevel.Info);
      return yield* getFallbackTarget(strategyContext).pipe(
        Effect.annotateLogs({
          strategy: 'fallback',
          reason: 'no_targets',
          aiPlayerType,
          availableTargets: 0,
        })
      );
    }

    // For browser AI, we don't require an API key since it uses universal strategy
    if (aiPlayerType === 'browserai') {
      yield* Effect.log('🧠 Using Browser AI strategy for target selection', LogLevel.Info);
      return yield* Effect.catchAll(getAiTarget(apiKey, strategyContext, aiPlayerType), (error) => {
        return Effect.gen(function* () {
          yield* Effect.log(
            '⚠️ Browser AI strategy failed, falling back to random strategy',
            LogLevel.Warning
          );
          yield* Effect.log('Browser AI Error details', LogLevel.Error, error);
          return yield* getFallbackTarget(strategyContext).pipe(
            Effect.annotateLogs({
              strategy: 'fallback',
              reason: 'browser_ai_failed',
              aiPlayerType,
              availableTargets: strategyContext.availableTargets.length,
            })
          );
        });
      });
    }

    // For OpenAI, check if API key is provided
    const apiKeyOption = apiKey ? Option.some(apiKey) : Option.none();

    return yield* Option.match(apiKeyOption, {
      onNone: () => {
        return Effect.gen(function* () {
          yield* Effect.log('💡 No OpenAI API key found, using fallback strategy', LogLevel.Info);
          return yield* getFallbackTarget(strategyContext).pipe(
            Effect.annotateLogs({
              strategy: 'fallback',
              reason: 'no_api_key',
              aiPlayerType,
              availableTargets: strategyContext.availableTargets.length,
            })
          );
        });
      },
      onSome: (apiKey) => {
        return Effect.gen(function* () {
          yield* Effect.log('🌐 Using OpenAI strategy for target selection', LogLevel.Info);
          return yield* Effect.catchAll(
            getAiTarget(apiKey, strategyContext, aiPlayerType),
            (error) => {
              return Effect.gen(function* () {
                yield* Effect.log(
                  '⚠️ OpenAI strategy failed, falling back to random strategy',
                  LogLevel.Warning
                );
                yield* Effect.log('OpenAI Error details', LogLevel.Error, error);
                return yield* getFallbackTarget(strategyContext).pipe(
                  Effect.annotateLogs({
                    strategy: 'fallback',
                    reason: 'openai_failed',
                    aiPlayerType,
                    availableTargets: strategyContext.availableTargets.length,
                  })
                );
              });
            }
          );
        });
      },
    });
  });
};

const agentTurn = (
  store: any,
  currentGame: any,
  myPlayer: string,
  opponentPlayer: string,
  semaphore: TSemaphore.TSemaphore
): Effect.Effect<void, any, unknown> => {
  return Effect.gen(function* () {
    const gameId = currentGame.id;

    // Get all missiles fired in this game to avoid duplicates
    const allFiredMissiles = store.query(allMissiles$(gameId)) || [];
    const firedCoordinates = new Set<string>(
      allFiredMissiles.map((missile: any) => `${missile.x},${missile.y}`)
    );

    // Log agent turn start
    yield* Effect.log(
      `🤖 Agent turn for player: ${myPlayer}, turn: ${currentGame.currentTurn}`,
      LogLevel.Info
    );
    yield* Effect.log(`Already fired at: ${firedCoordinates.size} locations`, LogLevel.Debug);

    // Build available targets list
    const availableTargets: { x: number; y: number }[] = [];
    for (let x = 0; x < GAME_CONFIG.colSize; x++) {
      for (let y = 0; y < GAME_CONFIG.rowSize; y++) {
        const coordString = `${x},${y}`;
        if (!firedCoordinates.has(coordString)) {
          availableTargets.push({ x, y });
        }
      }
    }

    // Build strategy context for AI analysis
    const strategyContext = buildStrategyContext(
      store,
      gameId,
      myPlayer,
      opponentPlayer,
      availableTargets
    );

    // Log game state analysis
    yield* Effect.log('🧠 AI analyzing game state', LogLevel.Info);
    yield* Effect.log('Game state details', LogLevel.Debug, {
      opponentHits: strategyContext.opponentHits.length,
      opponentMisses: strategyContext.opponentMisses.length,
      availableTargets: strategyContext.availableTargets.length,
    });

    // Get API key from environment
    const apiKey = (globalThis as any)?.process?.env?.VITE_OPENAI_API_KEY || '';

    // Get the aiPlayerType from the current game, defaulting to 'openai' for backward compatibility
    const aiPlayerType = (currentGame.aiPlayerType as 'openai' | 'browserai') || 'openai';

    // Get target coordinate using AI or fallback strategy
    const coordinate = yield* getTargetCoordinate(strategyContext, apiKey, aiPlayerType).pipe(
      Effect.withLogSpan('strategy_selection'),
      Effect.annotateLogs({
        gameId: gameId,
        player: myPlayer,
        opponentPlayer: opponentPlayer,
        aiPlayerType: aiPlayerType,
        gridSize: `${strategyContext.gridSize.rowSize}x${strategyContext.gridSize.colSize}`,
      }),
      Effect.provide(Logger.pretty),
      Effect.provide(OpenAiLanguageModel.layer({ model: 'gpt-4o-mini' })),
      Effect.provide(OpenAiClient.layer({ apiKey: Redacted.make(apiKey) }))
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
    store.commit(events.MissileFired(missile));

    // Process the missile using the same semaphore used for player actions
    yield* processMissileWithSemaphore(store, missile, gameId, myPlayer, opponentPlayer, semaphore);

    // Log turn completion
    yield* Effect.log(`🤖 AI Agent turn completed`, LogLevel.Info);
  }).pipe(
    Effect.catchAll((error) =>
      Effect.log('🚨 Agent turn failed completely', LogLevel.Error, error)
    ),
    Effect.provide(NodeHttpClient.layer),
    Effect.provide(Logger.pretty)
  );
};

const main = async () => {
  const adapter = makeAdapter({
    storage: { type: 'fs', baseDirectory: 'tmp' },
    sync: { backend: makeCfSync({ url: LIVESTORE_SYNC_URL }), onSyncError: 'ignore' },
  });

  const storeId = ENV.STORE_ID;
  if (!storeId) {
    throw new Error(
      'VITE_STORE_ID is not set in env variables. Configure same store id across all clients'
    );
  }

  // necessary to use same store id across all clients
  const store = await createStorePromise({
    adapter,
    schema,
    storeId,
    syncPayload: { authToken: 'insecure-token-change-me' },
  });

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

  store.subscribe(currentGame$(), {
    skipInitialRun: false,
    onUpdate: async (currentGame: any) => {
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
      unsubscribeHandlers.forEach((unsubscribe) => {
        unsubscribe?.();
      });
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

      // Listen to MissileFired events for all players - moved outside Effect loop
      const unsubscribeMissiles = store.subscribe(missiles$(currentGameId, myPlayer) as any, {
        skipInitialRun: false,
        // Issue: when specified true, onUpdate effect not being trigger even aftewards

        onSubscribe: async () => {
          await Effect.runPromise(
            Effect.log('Subscribed to missiles', LogLevel.Debug).pipe(Effect.provide(Logger.pretty))
          );
        },
        onUpdate: async (missiles: any[]) => {
          await Effect.runPromise(
            Effect.gen(function* () {
              yield* Effect.log(
                `🚀 Missiles fired: ${missiles.length}, myPlayer: ${myPlayer}`,
                LogLevel.Info
              );
              yield* Effect.log('Current game state', LogLevel.Debug, currentGame);
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

          /**
           *
           * Only 1 action per player at each turn
           *   - MissileFired events will be rejected if it's not player's turn
           *
           * Here we don't associate MissileFired event with turn. Users could rapidly click around where validations happen at server afterwards
           * (extra turn is granted when player hit a ship)
           *
           * Edge case when events are fired from multiple devices and arrived out of order
           *
           */
          console.log('missile', lastMissile.id, missiles?.[0]?.x, missiles?.[0]?.y);

          /**
           *
           * Only 1 action per player at each turn
           *   - MissileFired events will be rejected if it's not player's turn
           *
           * Here we don't associate MissileFired event with turn. Users could rapidly click around where validations happen at server afterwards
           * (extra turn is granted when player hit a ship)
           *
           * Edge case when events are fired from multiple devices and arrived out of order
           *
           */

          if (lastMissile.player !== currentGame.currentPlayer) {
            console.log('missile fired out of turn', lastMissile.player, currentGame.currentPlayer);
            return;
          }

          // Process missile to determine hit/miss and create result event
          const { missileResultEvent, nextPlayer } = processMissile(
            store,
            lastMissile,
            currentGameId,
            myPlayer,
            opponentPlayer
          );

          const lastAction = store.query(lastAction$(currentGameId)) as any;

          // store.query(lastMissile$(currentGameId, myPlayer));

          const missileResult = store.query(
            missileResultsById$(currentGameId, lastMissile.id)
          ) as any[];

          console.log('missile result', missileResult);

          if (missileResult?.length > 0) {
            return;
          }

          const newTurn = (lastAction?.turn ?? 0) + 1;

          if (lastMissile.player !== currentGame.currentPlayer) {
            await Effect.runPromise(
              Effect.log(
                `Missile fired out of turn - Player: ${lastMissile.player}, Current: ${currentGame.currentPlayer}`,
                LogLevel.Warning
              ).pipe(Effect.provide(Logger.pretty))
            );
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
              ) as Effect.Effect<void, any, never>
            ).pipe(Effect.provide(Logger.pretty))
          );
        },
      });

      // Could live in another client
      const unsubscribeLastAction = store.subscribe(lastAction$(currentGameId), {
        onUpdate: async (action: any) => {
          const game = store.query(currentGame$()) as any;

          await Effect.runPromise(
            Effect.gen(function* () {
              yield* Effect.log('Action updated', LogLevel.Debug, action);
              yield* Effect.log(`Next player: ${game?.currentPlayer}`, LogLevel.Info);
            }).pipe(Effect.provide(Logger.pretty))
          );

          // When using Browser AI, agent turns run on the client. Skip server agent turn.
          if (game?.aiPlayerType === 'browserai') {
            return;
          }

          if (game?.currentPlayer === 'player-2') {
            // Run agent turn asynchronously without blocking
            await Effect.runPromise(
              (
                agentTurn(
                  store,
                  currentGame,
                  'player-2',
                  'player-1',
                  missileProcessingSemaphore
                ) as Effect.Effect<void, any, never>
              ).pipe(Effect.provide(NodeHttpClient.layer), Effect.provide(Logger.pretty))
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
  });
};

// Define the router with a single route for the root URL
const router = HttpRouter.empty.pipe(HttpRouter.get('/health', HttpServerResponse.text('ok')));
// Set up the application server with logging
const app = router.pipe(HttpServer.serve(), HttpServer.withLogAddress);

listen(app, PORT);

main().catch(console.error);
