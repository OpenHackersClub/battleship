import type { MissileResult, SeaObject, StrategyContext } from '@battleship/domain';

// Re-export domain types for convenience
export type { StrategyContext, MissileResult, SeaObject };

export interface Coordinate {
  x: number;
  y: number;
}

export interface TargetResult {
  coordinate: Coordinate;
  reasoning?: string;
}

/**
 * AI Provider interface - implemented in platform-specific code (e.g., Cloudflare Workers)
 */
export interface AIProvider {
  selectTarget(context: StrategyContext): Promise<TargetResult | null>;
}

export interface MissileProcessResult {
  isHit: boolean;
  coordinate: Coordinate;
  hitPosition?: { x: number; y: number };
  nextPlayer: string;
}

export interface MissileResultWithHit extends MissileResult {
  isHit: boolean;
}
