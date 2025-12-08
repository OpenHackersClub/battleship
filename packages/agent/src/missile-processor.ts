import { getMissileHitPosition, type SeaObject } from '@battleship/domain';
import { events } from '@battleship/schema';

/**
 * Processes a missile and determines if it hits or misses opponent ships
 * @param missile - The missile object to process
 * @param opponentShips - Array of opponent ships to check collision against
 * @param gameId - The current game ID
 * @param currentPlayer - The player who fired the missile
 * @param opponentPlayer - The opponent player
 * @returns Object containing hit result, missile result event, and next player
 */
export const processMissile = (
  missile: { id: string; x: number; y: number; player: string },
  opponentShips: SeaObject[],
  gameId: string,
  currentPlayer: string,
  opponentPlayer: string
) => {
  // Check for collision using shared missile processing utilities
  // getMissileHitPosition expects a MissileResult with player field
  const missileResult = { id: missile.id, x: missile.x, y: missile.y, player: missile.player };
  const hitPosition = getMissileHitPosition(missileResult, opponentShips || []);
  const isHit = hitPosition !== undefined;

  // Create appropriate missile result event
  const missileResultEvent = isHit
    ? events.MissileHit({
        id: missile.id,
        gameId: gameId,
        x: missile.x,
        y: missile.y,
        player: currentPlayer,
        createdAt: new Date(),
      })
    : events.MissileMiss({
        id: missile.id,
        gameId: gameId,
        x: missile.x,
        y: missile.y,
        player: currentPlayer,
        createdAt: new Date(),
      });

  // Determine next player (if hit, current player gets another turn)
  const nextPlayer = isHit ? currentPlayer : opponentPlayer;

  return {
    isHit,
    hitPosition,
    missileResultEvent,
    nextPlayer,
  };
};
