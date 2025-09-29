import type { MissileResult } from './types';

export interface StrategyContext {
  gridSize: { rowSize: number; colSize: number };
  availableTargets: { x: number; y: number }[];
  opponentHits: MissileResult[];
  opponentMisses: MissileResult[];
}
