import { detectMissileHit, type MissileResult, type SeaObject } from '@battleship/domain';

export const useMissileHitDetection = () => {
  const checkMissileHit = (missile: MissileResult, ships: SeaObject[]): boolean => {
    return detectMissileHit(missile, ships ?? []);
  };

  return { checkMissileHit };
};
