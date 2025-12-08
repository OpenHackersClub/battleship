import { Effect, LogLevel, Logger, TSemaphore } from 'effect';
import { GAME_CONFIG } from '@battleship/domain';
import type { StrategyContext } from '@battleship/domain';
import { processMissile } from './missile-processor';
import { buildStrategyContext, buildAvailableTargets } from './context-builder';
import { getRandomCoordinate } from './strategy';
import type { StoreAdapter, GameData } from './store-adapter';
import type { Coordinate } from './types';

/**
 * AI Provider interface for target selection.
 * Implement this for different AI backends (Cloudflare AI, Browser AI, etc.)
 */
export interface AgentAIProvider {
  /**
   * Select a target coordinate using AI strategy
   */
  selectTarget(strategyContext: StrategyContext): Effect.Effect<Coordinate | null, unknown, never>;
}

/**
 * Fallback strategy - uses random selection
 */
const getFallbackTarget = (strategyContext: StrategyContext) => {
  return Effect.gen(function* () {
    const availableTargets = strategyContext.availableTargets;

    if (availableTargets.length === 0) {
      yield* Effect.log('🎲 No targets available for fallback strategy', LogLevel.Warning);
      return null;
    }

    const selectedTarget = getRandomCoordinate(availableTargets);
    if (selectedTarget) {
      yield* Effect.log(
        `🎲 Using random fallback strategy: (${selectedTarget.x}, ${selectedTarget.y})`,
        LogLevel.Info
      );
      return selectedTarget;
    }
    return null;
  });
};

/**
 * Get target coordinate using AI provider or fallback strategy
 */
const getTargetCoordinate = (
  strategyContext: StrategyContext,
  aiProvider: AgentAIProvider | undefined
) => {
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

    if (!aiProvider) {
      yield* Effect.log('💡 No AI provider available, using fallback strategy', LogLevel.Info);
      return yield* getFallbackTarget(strategyContext).pipe(
        Effect.annotateLogs({
          strategy: 'fallback',
          reason: 'no_ai_provider',
          availableTargets: strategyContext.availableTargets.length,
        })
      );
    }

    yield* Effect.log('🌐 Using AI strategy for target selection', LogLevel.Info);
    return yield* Effect.catchAll(aiProvider.selectTarget(strategyContext), () => {
      return Effect.gen(function* () {
        yield* Effect.log(
          '⚠️ AI strategy failed, falling back to random strategy',
          LogLevel.Warning
        );
        return yield* getFallbackTarget(strategyContext).pipe(
          Effect.annotateLogs({
            strategy: 'fallback',
            reason: 'ai_failed',
            availableTargets: strategyContext.availableTargets.length,
          })
        );
      });
    });
  });
};

/**
 * Process missile with semaphore to prevent race conditions
 */
export const processMissileWithSemaphore = (
  store: StoreAdapter,
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
          ? store.getOpponentShips(currentGameId, opponentPlayer)
          : [];

        // Process missile to determine hit/miss and create result event
        const { missileResultEvent, nextPlayer } = processMissile(
          lastMissile,
          opponentShips || [],
          currentGameId,
          myPlayer,
          opponentPlayer
        );

        const lastAction = store.getLastAction(currentGameId);
        const missileResult = store.getMissileResultById(currentGameId, lastMissile.id);

        yield* Effect.log('Missile result processed', LogLevel.Debug, missileResult);

        if (missileResult?.length > 0) {
          return;
        }

        const newTurn = (lastAction?.turn ?? 0) + 1;

        // Workaround issue https://github.com/livestorejs/livestore/issues/577 by committing on next tick
        // but still inside the semaphore critical section to avoid duplicates
        yield* Effect.sleep(1);

        // Fire either MissileHit or MissileMiss event based on collision result
        store.commitMissileResult(
          {
            id: crypto.randomUUID(),
            gameId: currentGameId,
            player: myPlayer,
            turn: newTurn,
            nextPlayer: nextPlayer,
          },
          missileResultEvent
        );
      })
    );
  });
};

/**
 * Agent turn configuration
 */
export interface AgentTurnConfig {
  store: StoreAdapter;
  currentGame: GameData;
  myPlayer: string;
  opponentPlayer: string;
  semaphore: TSemaphore.TSemaphore;
  aiProvider?: AgentAIProvider;
}

/**
 * Execute an agent turn - selects a target and fires a missile.
 * This is the main entry point for AI agent actions.
 *
 * Works with both:
 * - Cloudflare Workers (cloud mode)
 * - Browser (browser AI mode)
 */
export const agentTurn = (config: AgentTurnConfig): Effect.Effect<void, unknown, never> => {
  const { store, currentGame, myPlayer, opponentPlayer, semaphore, aiProvider } = config;

  return Effect.gen(function* () {
    const gameId = currentGame.id;

    // Get all missiles fired in this game to avoid duplicates
    const allFiredMissiles = store.getAllMissiles(gameId) || [];
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
    const opponentMissileResults = store.getMissileResults(gameId, opponentPlayer) || [];

    // Build strategy context for AI analysis
    const strategyContext = buildStrategyContext(opponentMissileResults, availableTargets);

    // Log game state analysis
    yield* Effect.log('🧠 AI analyzing game state', LogLevel.Info);
    yield* Effect.log('Game state details', LogLevel.Debug, {
      opponentHits: strategyContext.opponentHits.length,
      opponentMisses: strategyContext.opponentMisses.length,
      availableTargets: strategyContext.availableTargets.length,
    });

    // Get target coordinate using AI or fallback strategy
    const coordinate = yield* getTargetCoordinate(strategyContext, aiProvider).pipe(
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
    store.commitMissileFired(missile);

    // Process the missile using the semaphore to prevent race conditions
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
