import { GAME_CONFIG, type StrategyContext, type MissileResult } from '@battleship/domain';

interface MissileResultRow {
  id: string;
  x: number;
  y: number;
  player: string;
  isHit: boolean;
}

/**
 * Build strategy context from game state data
 */
export const buildStrategyContext = (
  opponentMissileResults: MissileResultRow[],
  availableTargets: { x: number; y: number }[]
): StrategyContext => {
  // Convert to the format expected by the AI strategy
  const opponentHits: MissileResult[] = opponentMissileResults
    .filter((result) => result.isHit)
    .map((result) => ({
      id: result.id,
      x: result.x,
      y: result.y,
      player: result.player,
    }));

  const opponentMisses: MissileResult[] = opponentMissileResults
    .filter((result) => !result.isHit)
    .map((result) => ({
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

/**
 * Build available targets list from game state
 */
export const buildAvailableTargets = (
  firedCoordinates: Set<string>,
  gridConfig = GAME_CONFIG
): { x: number; y: number }[] => {
  const availableTargets: { x: number; y: number }[] = [];
  for (let x = 0; x < gridConfig.colSize; x++) {
    for (let y = 0; y < gridConfig.rowSize; y++) {
      const coordString = `${x},${y}`;
      if (!firedCoordinates.has(coordString)) {
        availableTargets.push({ x, y });
      }
    }
  }
  return availableTargets;
};
