import { Effect, pipe, Schema, Redacted } from 'effect';
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

// Schema for AI response validation
const CoordinateSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  reasoning: Schema.String,
});

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
      if (availableCoords.length === 0) {
        return Effect.succeed(null as { x: number; y: number } | null);
      }

      const prompt = `You are an expert Battleship AI strategist. Analyze the current game state and select the optimal coordinate to maximize winning probability.
  
  GAME STATE:
  - Grid: ${context.gridSize.rowSize}x${context.gridSize.colSize}
  - Available targets: ${JSON.stringify(context.availableTargets)}
  - Opponent hits: ${JSON.stringify(context.opponentHits)}
  - Opponent misses: ${JSON.stringify(context.opponentMisses)}
  
  STRATEGIC OBJECTIVES:
  1. Use probability-based targeting for maximum ship-finding efficiency
  2. Avoid areas with many opponent misses to prevent clustering
  3. Consider ship lengths (1-3 cells) and optimal spacing patterns
  4. Look for patterns in opponent hits to understand their strategy
  5. Target areas that maximize the probability of hitting a ship
  
  You must respond with a JSON object containing your chosen coordinate and reasoning.
  The coordinate MUST be from the available targets list.`;

      return pipe(
        AiLanguageModel.generateObject({
          prompt,
          schema: CoordinateSchema,
        }),
        Effect.map((response) => {
          const result = response.value;
          console.log('🤖 AI reasoning:', result.reasoning);

          // Validate that the selected coordinate is in available targets
          const selectedCoord = { x: result.x, y: result.y };
          const isValidTarget = globalThis.Array.from(availableCoords).some(
            (coord: { x: number; y: number }) =>
              coord.x === selectedCoord.x && coord.y === selectedCoord.y
          );

          if (!isValidTarget) {
            console.warn('⚠️ AI selected invalid coordinate, falling back to random selection');
            const randomIndex = Math.floor(Math.random() * availableCoords.length);
            return availableCoords[randomIndex] || null;
          }

          return selectedCoord;
        }),
        Effect.catchAll((error) => {
          console.warn('🔄 AI strategy failed, falling back to random selection:', error);
          // Fallback to random selection
          const randomIndex = Math.floor(Math.random() * availableCoords.length);
          return Effect.succeed(availableCoords[randomIndex] || null);
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
