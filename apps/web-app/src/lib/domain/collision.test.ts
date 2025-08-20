import { describe, expect, it } from 'vitest';
import type { Missle, Ship } from '@/lib/domain/SeaObject';
import { isColliding } from './collision';

describe('isColliding', () => {
  const createShip = (
    id: string,
    x: number,
    y: number,
    length: number,
    orientation: 0 | 90,
    player: string
  ): Ship => ({
    id,
    x,
    y,
    player,
    length,
    orientation,
  });

  const createMissle = (id: string, x: number, y: number): Missle => ({
    id,
    x,
    y,
    player: 'player1',
    length: 1,
    orientation: 0,
  });

  it('should return undefined when no other ships exist', () => {
    const ship = createShip('1', 0, 0, 3, 0);
    const result = isColliding(ship, []);
    expect(result).toBeUndefined();
  });

  it('should return undefined when ships do not overlap', () => {
    const ship1 = createShip('1', 0, 0, 3, 0); // horizontal: (0,0), (1,0), (2,0)
    const ship2 = createShip('2', 0, 1, 2, 0); // horizontal: (0,1), (1,1)
    const result = isColliding(ship1, [ship2]);
    expect(result).toBeUndefined();
  });

  it('should return first overlapping position when horizontal ships overlap', () => {
    const ship1 = createShip('1', 0, 0, 3, 0); // horizontal: (0,0), (1,0), (2,0)
    const ship2 = createShip('2', 2, 0, 2, 0); // horizontal: (2,0), (3,0)
    const result = isColliding(ship1, [ship2]);
    expect(result).toEqual({ x: 2, y: 0 });
  });

  it('should return first overlapping position when vertical ships overlap', () => {
    const ship1 = createShip('1', 0, 0, 3, 90); // vertical: (0,0), (0,1), (0,2)
    const ship2 = createShip('2', 0, 2, 2, 90); // vertical: (0,2), (0,3)
    const result = isColliding(ship1, [ship2]);
    expect(result).toEqual({ x: 0, y: 2 });
  });

  it('should return the crossing position when horizontal and vertical ships cross', () => {
    const ship1 = createShip('1', 0, 1, 3, 0); // horizontal: (0,1), (1,1), (2,1)
    const ship2 = createShip('2', 1, 0, 3, 90); // vertical: (1,0), (1,1), (1,2)
    const result = isColliding(ship1, [ship2]);
    expect(result).toEqual({ x: 1, y: 1 });
  });

  it('should return undefined when ships are adjacent but not overlapping', () => {
    const ship1 = createShip('1', 0, 0, 2, 0); // horizontal: (0,0), (1,0)
    const ship2 = createShip('2', 2, 0, 2, 0); // horizontal: (2,0), (3,0)
    const result = isColliding(ship1, [ship2]);
    expect(result).toBeUndefined();
  });

  it('should ignore the ship itself when checking collisions', () => {
    const ship = createShip('1', 0, 0, 3, 0);
    const result = isColliding(ship, [ship]);
    expect(result).toBeUndefined();
  });

  it('should check against multiple ships', () => {
    const ship1 = createShip('1', 0, 0, 3, 0); // horizontal: (0,0), (1,0), (2,0)
    const ship2 = createShip('2', 0, 1, 2, 0); // horizontal: (0,1), (1,1)
    const ship3 = createShip('3', 1, 0, 2, 90); // vertical: (1,0), (1,1)
    const result = isColliding(ship1, [ship2, ship3]);
    expect(result).toEqual({ x: 1, y: 0 });
  });

  it('should return the missile position when it collides with a ship', () => {
    const ship = createShip('s1', 1, 0, 3, 0); // (1,0), (2,0), (3,0)
    const missle = createMissle('m1', 2, 0); // (2,0)
    const result = isColliding(missle, [ship]);
    expect(result).toEqual({ x: 2, y: 0 });
  });
});
