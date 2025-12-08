import type { SeaObject } from '@battleship/domain';

/**
 * Missile data structure
 */
export interface MissileData {
  id: string;
  x: number;
  y: number;
  player: string;
}

/**
 * Missile result data structure
 */
export interface MissileResultData {
  id: string;
  x: number;
  y: number;
  player: string;
  isHit: boolean;
}

/**
 * Game data structure
 */
export interface GameData {
  id: string;
  currentTurn: number;
  currentPlayer: string;
  players: string[];
}

/**
 * Last action data structure
 */
export interface LastActionData {
  turn?: number;
}

/**
 * Platform-agnostic store adapter interface.
 * This allows the agent logic to work with different store implementations
 * (e.g., Cloudflare Durable Objects, browser-based stores).
 */
export interface StoreAdapter {
  /**
   * Get all missiles fired in a game
   */
  getAllMissiles(gameId: string): MissileData[];

  /**
   * Get opponent ships for collision detection
   */
  getOpponentShips(gameId: string, opponentPlayer: string): SeaObject[];

  /**
   * Get missile results for a player
   */
  getMissileResults(gameId: string, player: string): MissileResultData[];

  /**
   * Get missile result by ID
   */
  getMissileResultById(gameId: string, missileId: string): MissileResultData[];

  /**
   * Get the last action for a game
   */
  getLastAction(gameId: string): LastActionData | null;

  /**
   * Get the current game state
   */
  getCurrentGame(): GameData | null;

  /**
   * Commit a missile fired event
   */
  commitMissileFired(missile: {
    id: string;
    gameId: string;
    player: string;
    x: number;
    y: number;
    createdAt: Date;
  }): void;

  /**
   * Commit missile result and action completed events
   */
  commitMissileResult(
    actionCompleted: {
      id: string;
      gameId: string;
      player: string;
      turn: number;
      nextPlayer: string;
    },
    missileResultEvent: unknown
  ): void;
}
