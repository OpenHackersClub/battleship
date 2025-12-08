import {
  type AgentAIProvider,
  type AIProvider,
  type Coordinate,
  generateBattleshipPrompt,
  getRandomCoordinate,
  parseAIResponse,
  type TargetResult,
} from '@battleship/agent';
import type { StrategyContext } from '@battleship/domain';
import type { Ai } from '@cloudflare/workers-types';
import { Effect, LogLevel } from 'effect';

/**
 * Cloudflare Workers AI implementation of the AIProvider interface
 */
export class CloudflareAIProvider implements AIProvider {
  constructor(private ai: Ai) {}

  async selectTarget(context: StrategyContext): Promise<TargetResult | null> {
    const availableCoords = context.availableTargets;
    const randomFallback = getRandomCoordinate(availableCoords);

    if (!randomFallback) {
      return null;
    }

    const prompt = generateBattleshipPrompt(context);

    try {
      const response = await this.ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [
          {
            role: 'system',
            content:
              'You are a Battleship game AI. Always respond with valid JSON containing x, y coordinates and reasoning.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 256,
      });

      const text = (response as { response?: string }).response || '';
      const coordinate = parseAIResponse(text, availableCoords, 'Cloudflare AI');

      if (coordinate) {
        return { coordinate };
      }

      return { coordinate: randomFallback };
    } catch (error) {
      console.warn('🔄 Cloudflare AI strategy failed, falling back to random selection:', error);
      return { coordinate: randomFallback };
    }
  }
}

/**
 * Cloudflare Workers AI implementation of the AgentAIProvider interface.
 * This is used by the refactored agentTurn function.
 */
export class CloudflareAgentAIProvider implements AgentAIProvider {
  constructor(private ai: Ai) {}

  selectTarget(strategyContext: StrategyContext): Effect.Effect<Coordinate | null, unknown, never> {
    return Effect.gen(
      function* (this: CloudflareAgentAIProvider) {
        yield* Effect.log('🌐 Using Cloudflare Workers AI strategy...', LogLevel.Info);

        const provider = new CloudflareAIProvider(this.ai);
        const result = yield* Effect.tryPromise({
          try: () => provider.selectTarget(strategyContext),
          catch: (error) => error,
        });

        return result?.coordinate || null;
      }.bind(this)
    ).pipe(
      Effect.annotateLogs({
        strategy: 'cloudflare-ai',
        model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        availableTargets: strategyContext.availableTargets.length,
        opponentHits: strategyContext.opponentHits.length,
        opponentMisses: strategyContext.opponentMisses.length,
      })
    );
  }
}

/**
 * Effect-based wrapper for AI target selection
 * @deprecated Use CloudflareAgentAIProvider with agentTurn instead
 */
export const pickTargetWithAI = ({
  context,
  ai,
}: {
  context: StrategyContext;
  ai: Ai;
}): Effect.Effect<{ x: number; y: number } | null, never, never> => {
  const provider = new CloudflareAIProvider(ai);

  return Effect.tryPromise({
    try: async () => {
      const result = await provider.selectTarget(context);
      return result?.coordinate || null;
    },
    catch: (error) => {
      console.warn('🔄 Cloudflare AI strategy failed:', error);
      return error;
    },
  }).pipe(Effect.catchAll(() => Effect.succeed(getRandomCoordinate(context.availableTargets))));
};
