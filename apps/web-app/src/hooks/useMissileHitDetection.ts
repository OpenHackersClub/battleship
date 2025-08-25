import { isColliding } from '@/lib/domain/collision';
import type { SeaObject } from '@/lib/domain/SeaObject';

export interface MissileResult {
  id: string;
  x: number;
  y: number;
  player: string;
}

export const useMissileHitDetection = () => {
  const checkMissileHit = (missile: MissileResult, ships: SeaObject[]): boolean => {
    const missileAsSeaObject: SeaObject = {
      id: missile.id,
      x: missile.x,
      y: missile.y,
      length: 1,
      orientation: 0 as const,
      player: missile.player,
    };

    const collisionPoint = isColliding(missileAsSeaObject, [...(ships ?? [])]);
    return !!collisionPoint;
  };

  return { checkMissileHit };
};
