import type { StrategyContext } from '@battleship/domain';
import type { Coordinate } from './types';

/**
 * Generate battleship strategy prompt for AI models
 */
export const generateBattleshipPrompt = (context: StrategyContext): string => {
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
The coordinate MUST be from the available targets list.
Example response: {"x": 5, "y": 3, "reasoning": "Targeting center of unexplored area"}`;
};

/**
 * Validate that a coordinate is within the available targets and return fallback if invalid
 */
export const validateCoordinateOrFallback = (
  selectedCoord: Coordinate,
  availableCoords: ReadonlyArray<Coordinate>,
  aiType: string
): Coordinate | null => {
  const isValidTarget = globalThis.Array.from(availableCoords).some(
    (coord: Coordinate) => coord.x === selectedCoord.x && coord.y === selectedCoord.y
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
export const getRandomCoordinate = (
  availableCoords: ReadonlyArray<Coordinate>
): Coordinate | null => {
  if (availableCoords.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * availableCoords.length);
  return availableCoords[randomIndex] || null;
};

/**
 * Parse AI response to extract coordinates
 */
export const parseAIResponse = (
  responseText: string,
  availableCoords: ReadonlyArray<Coordinate>,
  aiType: string
): Coordinate | null => {
  // Extract JSON object from response
  const match = responseText.match(/\{[\s\S]*\}/);
  const jsonString = match ? match[0] : responseText;

  let result: { x?: number; y?: number; reasoning?: string } = {};
  try {
    result = JSON.parse(jsonString);
  } catch {
    console.warn('🔄 Failed to parse AI response, falling back to random selection');
    return getRandomCoordinate(availableCoords);
  }

  if (typeof result?.x === 'number' && typeof result?.y === 'number') {
    console.log(`🤖 ${aiType} reasoning:`, result?.reasoning);
    const selectedCoord = { x: result.x, y: result.y };
    return validateCoordinateOrFallback(selectedCoord, availableCoords, aiType);
  }

  return getRandomCoordinate(availableCoords);
};
