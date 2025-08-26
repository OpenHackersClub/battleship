// Game configuration constants
export const GAME_CONFIG = {
  rowSize: 6,
  colSize: 6,
  shipCount: 3,
  maxShipLength: 3,
} as const;

export type GameConfig = typeof GAME_CONFIG;