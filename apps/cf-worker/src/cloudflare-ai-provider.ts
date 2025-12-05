import type { Ai } from '@cloudflare/workers-types';
import type { StrategyContext } from '@battleship/domain';
import {
  type AIProvider,
  type TargetResult,
  generateBattleshipPrompt,
  getRandomCoordinate,
  parseAIResponse,
} from '@battleship/agent';
import { Effect } from 'effect';

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
 * Effect-based wrapper for AI target selection
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
