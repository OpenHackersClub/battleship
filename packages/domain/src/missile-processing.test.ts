import { describe, expect, it } from 'vitest';
import { detectMissileHit, getMissileHitPosition } from './missile-processing';
import type { MissileResult, SeaObject } from './types';

describe('missile processing', () => {
  const createMissileResult = (
    id: string,
    x: number,
    y: number,
    player = 'player-1'
  ): MissileResult => ({
    id,
    x,
    y,
    player,
  });

  const createShip = (
    id: string,
    x: number,
    y: number,
    length: number,
    orientation: 0 | 90,
    player = 'player-2'
  ): SeaObject => ({
    id,
    x,
    y,
    length,
    orientation,
    player,
  });

  describe('detectMissileHit', () => {
    it('returns false when no ships are present', () => {
      const missile = createMissileResult('m1', 2, 3);
      const result = detectMissileHit(missile, []);
      expect(result).toBe(false);
    });

    it('returns false when missile misses all ships', () => {
      const missile = createMissileResult('m1', 5, 5);
      const ships = [
        createShip('s1', 0, 0, 3, 0), // horizontal: (0,0), (1,0), (2,0)
        createShip('s2', 1, 2, 2, 90), // vertical: (1,2), (1,3)
      ];
      const result = detectMissileHit(missile, ships);
      expect(result).toBe(false);
    });

    it('returns true when missile hits horizontal ship', () => {
      const missile = createMissileResult('m1', 1, 0);
      const ships = [
        createShip('s1', 0, 0, 3, 0), // horizontal: (0,0), (1,0), (2,0)
      ];
      const result = detectMissileHit(missile, ships);
      expect(result).toBe(true);
    });

    it('returns true when missile hits vertical ship', () => {
      const missile = createMissileResult('m1', 2, 1);
      const ships = [
        createShip('s1', 2, 0, 3, 90), // vertical: (2,0), (2,1), (2,2)
      ];
      const result = detectMissileHit(missile, ships);
      expect(result).toBe(true);
    });

    it('returns true when missile hits one of multiple ships', () => {
      const missile = createMissileResult('m1', 4, 3);
      const ships = [
        createShip('s1', 0, 0, 2, 0), // horizontal: (0,0), (1,0)
        createShip('s2', 3, 3, 3, 0), // horizontal: (3,3), (4,3), (5,3)
        createShip('s3', 1, 5, 2, 90), // vertical: (1,5), (1,6)
      ];
      const result = detectMissileHit(missile, ships);
      expect(result).toBe(true);
    });

    it('handles missile at ship origin', () => {
      const missile = createMissileResult('m1', 3, 2);
      const ships = [
        createShip('s1', 3, 2, 4, 0), // horizontal: (3,2), (4,2), (5,2), (6,2)
      ];
      const result = detectMissileHit(missile, ships);
      expect(result).toBe(true);
    });

    it('handles missile at ship end', () => {
      const missile = createMissileResult('m1', 6, 2);
      const ships = [
        createShip('s1', 3, 2, 4, 0), // horizontal: (3,2), (4,2), (5,2), (6,2)
      ];
      const result = detectMissileHit(missile, ships);
      expect(result).toBe(true);
    });

    it('correctly handles missile that misses by one cell', () => {
      const missile = createMissileResult('m1', 7, 2);
      const ships = [
        createShip('s1', 3, 2, 4, 0), // horizontal: (3,2), (4,2), (5,2), (6,2)
      ];
      const result = detectMissileHit(missile, ships);
      expect(result).toBe(false);
    });
  });

  describe('getMissileHitPosition', () => {
    it('returns undefined when no ships are present', () => {
      const missile = createMissileResult('m1', 2, 3);
      const result = getMissileHitPosition(missile, []);
      expect(result).toBeUndefined();
    });

    it('returns undefined when missile misses all ships', () => {
      const missile = createMissileResult('m1', 5, 5);
      const ships = [
        createShip('s1', 0, 0, 3, 0), // horizontal: (0,0), (1,0), (2,0)
        createShip('s2', 1, 2, 2, 90), // vertical: (1,2), (1,3)
      ];
      const result = getMissileHitPosition(missile, ships);
      expect(result).toBeUndefined();
    });

    it('returns hit position when missile hits horizontal ship', () => {
      const missile = createMissileResult('m1', 1, 0);
      const ships = [
        createShip('s1', 0, 0, 3, 0), // horizontal: (0,0), (1,0), (2,0)
      ];
      const result = getMissileHitPosition(missile, ships);
      expect(result).toEqual({ x: 1, y: 0 });
    });

    it('returns hit position when missile hits vertical ship', () => {
      const missile = createMissileResult('m1', 2, 1);
      const ships = [
        createShip('s1', 2, 0, 3, 90), // vertical: (2,0), (2,1), (2,2)
      ];
      const result = getMissileHitPosition(missile, ships);
      expect(result).toEqual({ x: 2, y: 1 });
    });

    it('returns first collision position when missile hits multiple overlapping ships', () => {
      // This tests the collision detection logic - if ships overlap,
      // it should return the first collision found
      const missile = createMissileResult('m1', 2, 1);
      const ships = [
        createShip('s1', 0, 1, 4, 0), // horizontal: (0,1), (1,1), (2,1), (3,1)
        createShip('s2', 2, 0, 3, 90), // vertical: (2,0), (2,1), (2,2)
      ];
      const result = getMissileHitPosition(missile, ships);
      expect(result).toEqual({ x: 2, y: 1 });
    });

    it('returns missile position when hitting ship origin', () => {
      const missile = createMissileResult('m1', 3, 2);
      const ships = [
        createShip('s1', 3, 2, 4, 0), // horizontal: (3,2), (4,2), (5,2), (6,2)
      ];
      const result = getMissileHitPosition(missile, ships);
      expect(result).toEqual({ x: 3, y: 2 });
    });

    it('returns missile position when hitting ship end', () => {
      const missile = createMissileResult('m1', 6, 2);
      const ships = [
        createShip('s1', 3, 2, 4, 0), // horizontal: (3,2), (4,2), (5,2), (6,2)
      ];
      const result = getMissileHitPosition(missile, ships);
      expect(result).toEqual({ x: 6, y: 2 });
    });

    it('returns undefined when missile is adjacent but not hitting', () => {
      const missile = createMissileResult('m1', 2, 1);
      const ships = [
        createShip('s1', 0, 0, 2, 0), // horizontal: (0,0), (1,0) - adjacent to (2,1)
      ];
      const result = getMissileHitPosition(missile, ships);
      expect(result).toBeUndefined();
    });
  });

  describe('missile as SeaObject conversion', () => {
    // These tests verify that the internal conversion from MissileResult to SeaObject works correctly
    it('treats missile as 1x1 SeaObject with horizontal orientation', () => {
      const missile = createMissileResult('m1', 3, 4);
      const ship = createShip('s1', 3, 4, 1, 0); // Same position, 1x1

      const hitResult = detectMissileHit(missile, [ship]);
      const positionResult = getMissileHitPosition(missile, [ship]);

      expect(hitResult).toBe(true);
      expect(positionResult).toEqual({ x: 3, y: 4 });
    });

    it('correctly handles missile player vs ship player in collision logic', () => {
      // The collision detection should work regardless of player ownership
      const missile = createMissileResult('m1', 1, 1, 'attacker');
      const ship = createShip('s1', 1, 1, 1, 0, 'defender');

      const hitResult = detectMissileHit(missile, [ship]);
      expect(hitResult).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles empty missile id', () => {
      const missile = createMissileResult('', 1, 1);
      const ship = createShip('s1', 1, 1, 1, 0);

      const hitResult = detectMissileHit(missile, [ship]);
      expect(hitResult).toBe(true);
    });

    it('handles negative coordinates', () => {
      const missile = createMissileResult('m1', -1, -1);
      const ship = createShip('s1', -1, -1, 1, 0);

      const hitResult = detectMissileHit(missile, [ship]);
      expect(hitResult).toBe(true);
    });

    it('handles large coordinates', () => {
      const missile = createMissileResult('m1', 100, 200);
      const ship = createShip('s1', 100, 200, 1, 0);

      const hitResult = detectMissileHit(missile, [ship]);
      expect(hitResult).toBe(true);
    });
  });
});
