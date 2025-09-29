import { Effect, pipe, Redacted } from 'effect';
import * as AiLanguageModel from '@effect/ai/AiLanguageModel';
import * as OpenAiLanguageModel from '@effect/ai-openai/OpenAiLanguageModel';
import * as OpenAiClient from '@effect/ai-openai/OpenAiClient';
import { decodeCoordinates } from '@battleship/domain';
import type { StrategyContext, MissileResult } from '@battleship/domain';

export interface MissileResultWithHit extends MissileResult {
  isHit: boolean;
}

export interface Coordinate {
  x: number;
  y: number;
}

// Schema for AI response validation is imported from browser-ai-provider

/**
 * Generate battleship strategy prompt for AI models
 */
const generateBattleshipPrompt = (context: StrategyContext): string => {
  return `You are an expert Battleship AI strategist. Analyze the current game state and select the optimal coordinate to maximize winning probability.

GAME STATE:
- Grid: ${context.gridSize.rowSize}x${context.gridSize.colSize}
- Available targets: ${JSON.stringify(context.availableTargets)}
- Opponent hits: ${JSON.stringify(context.opponentHits)}
- Opponent misses: ${JSON.stringify(context.opponentMisses)}

STRATEGIC OBJECTIVES:
1. Use probability-based targeting for maximum ship-finding efficiency
2. Consider ship lengths (1-3 cells) and optimal spacing patterns
3. Target areas that maximize the probability of hitting a ship

You must respond with a JSON object containing your chosen coordinate and reasoning.
The coordinate MUST be from the available targets list.`;
};

/**
 * Validate that a coordinate is within the available targets and return fallback if invalid
 */
const validateCoordinateOrFallback = (
  selectedCoord: { x: number; y: number },
  availableCoords: ReadonlyArray<{ x: number; y: number }>,
  aiType: string
): { x: number; y: number } | null => {
  const isValidTarget = globalThis.Array.from(availableCoords).some(
    (coord: { x: number; y: number }) => coord.x === selectedCoord.x && coord.y === selectedCoord.y
  );

  if (!isValidTarget) {
    console.warn(`⚠️ ${aiType} selected invalid coordinate, falling back to random selection`);
    const randomIndex = Math.floor(Math.random() * availableCoords.length);
    return availableCoords[randomIndex] || null;
  }

  return selectedCoord;
};

/**
 * Get random coordinate fallback
 */
const getRandomCoordinate = (
  availableCoords: ReadonlyArray<{ x: number; y: number }>
): { x: number; y: number } | null => {
  if (availableCoords.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * availableCoords.length);
  return availableCoords[randomIndex] || null;
};

/**
 * AI-powered strategy using @effect/ai-openai for optimal coordinate selection
 * Uses OpenAI to analyze game state and pick winning moves according to the Effect AI documentation
 */
export const pickTargetWithAI = ({
  context,
  apiKey,
  model = 'gpt-4o-mini',
}: {
  context: StrategyContext;
  apiKey: string;
  model?: string;
}): Effect.Effect<{ x: number; y: number } | null, never, unknown> => {
  return pipe(
    // Use available coordinates directly since they're already decoded
    Effect.succeed(context.availableTargets),
    Effect.flatMap((availableCoords: ReadonlyArray<{ x: number; y: number }>) => {
      const randomFallback = getRandomCoordinate(availableCoords);
      if (!randomFallback) {
        return Effect.succeed(null as { x: number; y: number } | null);
      }

      const prompt = generateBattleshipPrompt(context);

      return pipe(
        AiLanguageModel.generateText({ prompt, outputLanguage: 'en' }),
        Effect.map((response) => {
          const text = response.text;
          // Extract JSON object from response
          const match = text.match(/\{[\s\S]*\}/);
          const jsonString = match ? match[0] : text;
          let result: any = {};
          try {
            result = JSON.parse(jsonString);
          } catch {
            // Fallback to random if parsing fails
            return randomFallback;
          }
          if (typeof result?.x === 'number' && typeof result?.y === 'number') {
            console.log('🤖 OpenAI reasoning:', result?.reasoning);
            const selectedCoord = { x: result.x, y: result.y };
            return validateCoordinateOrFallback(selectedCoord, availableCoords, 'OpenAI');
          }
          return randomFallback;
        }),
        Effect.catchAll((error) => {
          console.warn('🔄 OpenAI strategy failed, falling back to random selection:', error);
          return Effect.succeed(randomFallback);
        }),
        Effect.provide(
          OpenAiLanguageModel.layer({
            model,
          })
        ),
        Effect.provide(
          OpenAiClient.layer({
            apiKey: Redacted.make(apiKey),
          })
        )
      );
    })
  );
};

// Removed browser-based strategies from server environment.

/**
 * Fallback strategy that finds a random empty target
 */
export const pickTarget = ({
  emptyCoordinates,
}: {
  emptyCoordinates: Set<number>;
  context?: StrategyContext;
}): Coordinate | null => {
  const decodedCoordinates = globalThis.Array.from(emptyCoordinates).map(decodeCoordinates);

  if (decodedCoordinates.length === 0) {
    return null;
  }

  // Simple random selection as fallback
  const randomIndex = Math.floor(Math.random() * decodedCoordinates.length);
  return decodedCoordinates[randomIndex] || null;
};
