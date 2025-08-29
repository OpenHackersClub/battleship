import { isColliding } from './collision';
import type { MissileResult, SeaObject } from './types';

/**
 * Detects if a missile hits any of the given ships
 */
export const detectMissileHit = (missile: MissileResult, ships: SeaObject[]): boolean => {
  const missileSeaObject: SeaObject = {
    id: missile.id,
    x: missile.x,
    y: missile.y,
    length: 1,
    orientation: 0 as const,
    player: missile.player,
  };
  return !!isColliding(missileSeaObject, ships);
};

/**
 * Returns the collision point if missile hits any ship, undefined otherwise
 */
export const getMissileHitPosition = (missile: MissileResult, ships: SeaObject[]) => {
  const missileSeaObject: SeaObject = {
    id: missile.id,
    x: missile.x,
    y: missile.y,
    length: 1,
    orientation: 0 as const,
    player: missile.player,
  };
  return isColliding(missileSeaObject, ships);
};