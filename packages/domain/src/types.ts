// Re-export core types from SeaObject
export type { SeaObject, Ship, Missile } from './SeaObject';

// Missile result types for game events
export interface MissileResult {
  id: string;
  x: number;
  y: number;
  player: string;
}

// Grid configuration constants
export const GRID_CONSTANTS = {
  DEFAULT_ROWS: 10,
  DEFAULT_COLS: 10,
  MAX_SHIP_LENGTH: 5,
} as const;

// Missile visualization constants
export const MISSILE_CONSTANTS = {
  CROSS: {
    SIZE: 14,
    THICKNESS: 2,
    COLOR: '#991b1b',
  },
  DOT: {
    SIZE: 10,
    COLOR: '#1e3a8a',
    SHADOW: '0 0 0 1px rgba(0,0,0,0.2)',
  },
} as const;
