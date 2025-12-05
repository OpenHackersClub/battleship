import type { AgentAIProvider, Coordinate } from '@battleship/agent';
import { generateBattleshipPrompt, getRandomCoordinate, parseAIResponse } from '@battleship/agent';
import type { StrategyContext } from '@battleship/domain';
import { Effect, LogLevel } from 'effect';
import { checkBrowserAiAvailability, generateObjectWithBrowserAI } from './browser-ai-provider';

/**
 * Browser AI implementation of the AgentAIProvider interface.
 * Uses Chrome's built-in Gemini Nano model via the LanguageModel API.
 */
export class BrowserAgentAIProvider implements AgentAIProvider {
  selectTarget(strategyContext: StrategyContext): Effect.Effect<Coordinate | null, unknown, never> {
    return Effect.gen(function* () {
      yield* Effect.log('🌐 Using Browser AI strategy...', LogLevel.Info);

      // Check if Browser AI is available
      const availability = yield* Effect.tryPromise({
        try: () => checkBrowserAiAvailability(),
        catch: (error) => error,
      });

      if (availability !== 'available') {
        yield* Effect.log(
          `⚠️ Browser AI not available (status: ${availability}), falling back`,
          LogLevel.Warning
        );
        return getRandomCoordinate(strategyContext.availableTargets);
      }

      // Generate prompt and call Browser AI
      const prompt = generateBattleshipPrompt(strategyContext);

      const response = yield* Effect.tryPromise({
        try: () =>
          generateObjectWithBrowserAI<{ x: number; y: number; reasoning?: string }>({
            prompt,
            temperature: 0.7,
            topK: 3,
          }),
        catch: (error) => error,
      });

      if (
        response &&
        typeof response.value?.x === 'number' &&
        typeof response.value?.y === 'number'
      ) {
        yield* Effect.log(
          `🤖 Browser AI reasoning: ${response.value.reasoning || 'N/A'}`,
          LogLevel.Debug
        );

        // Validate the coordinate
        const coordinate = parseAIResponse(
          JSON.stringify(response.value),
          strategyContext.availableTargets,
          'Browser AI'
        );

        return coordinate;
      }

      yield* Effect.log('⚠️ Browser AI returned invalid response, falling back', LogLevel.Warning);
      return getRandomCoordinate(strategyContext.availableTargets);
    }).pipe(
      Effect.annotateLogs({
        strategy: 'browser-ai',
        model: 'gemini-nano',
        availableTargets: strategyContext.availableTargets.length,
        opponentHits: strategyContext.opponentHits.length,
        opponentMisses: strategyContext.opponentMisses.length,
      }),
      Effect.catchAll((error) => {
        console.warn('🔄 Browser AI strategy failed:', error);
        return Effect.succeed(getRandomCoordinate(strategyContext.availableTargets));
      })
    );
  }
}
