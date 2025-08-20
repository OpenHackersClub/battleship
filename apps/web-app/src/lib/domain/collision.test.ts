import { describe, expect, it } from 'vitest';
import type { Ship } from '@/components/Ship';
import { isShipColliding } from './collision';

describe('isShipColliding', () => {
  const createShip = (
    id: string,
    x: number,
    y: number,
    length: number,
    orientation: 0 | 90
  ): Ship => ({
    id,
    x,
    y,
    colorClass: 'bg-red-500 border-red-600',
    length,
    orientation,
  });

  it('should return false when no other ships exist', () => {
    const ship = createShip('1', 0, 0, 3, 0);
    const result = isShipColliding(ship, []);
    expect(result).toBe(false);
  });

  it('should return false when ships do not overlap', () => {
    const ship1 = createShip('1', 0, 0, 3, 0); // horizontal: (0,0), (1,0), (2,0)
    const ship2 = createShip('2', 0, 1, 2, 0); // horizontal: (0,1), (1,1)
    const result = isShipColliding(ship1, [ship2]);
    expect(result).toBe(false);
  });

  it('should return true when horizontal ships overlap', () => {
    const ship1 = createShip('1', 0, 0, 3, 0); // horizontal: (0,0), (1,0), (2,0)
    const ship2 = createShip('2', 2, 0, 2, 0); // horizontal: (2,0), (3,0)
    const result = isShipColliding(ship1, [ship2]);
    expect(result).toBe(true);
  });

  it('should return true when vertical ships overlap', () => {
    const ship1 = createShip('1', 0, 0, 3, 90); // vertical: (0,0), (0,1), (0,2)
    const ship2 = createShip('2', 0, 2, 2, 90); // vertical: (0,2), (0,3)
    const result = isShipColliding(ship1, [ship2]);
    expect(result).toBe(true);
  });

  it('should return true when horizontal and vertical ships cross', () => {
    const ship1 = createShip('1', 0, 1, 3, 0); // horizontal: (0,1), (1,1), (2,1)
    const ship2 = createShip('2', 1, 0, 3, 90); // vertical: (1,0), (1,1), (1,2)
    const result = isShipColliding(ship1, [ship2]);
    expect(result).toBe(true);
  });

  it('should return false when ships are adjacent but not overlapping', () => {
    const ship1 = createShip('1', 0, 0, 2, 0); // horizontal: (0,0), (1,0)
    const ship2 = createShip('2', 2, 0, 2, 0); // horizontal: (2,0), (3,0)
    const result = isShipColliding(ship1, [ship2]);
    expect(result).toBe(false);
  });

  it('should ignore the ship itself when checking collisions', () => {
    const ship = createShip('1', 0, 0, 3, 0);
    const result = isShipColliding(ship, [ship]);
    expect(result).toBe(false);
  });

  it('should check against multiple ships', () => {
    const ship1 = createShip('1', 0, 0, 3, 0); // horizontal: (0,0), (1,0), (2,0)
    const ship2 = createShip('2', 0, 1, 2, 0); // horizontal: (0,1), (1,1)
    const ship3 = createShip('3', 1, 0, 2, 90); // vertical: (1,0), (1,1)
    const result = isShipColliding(ship1, [ship2, ship3]);
    expect(result).toBe(true);
  });
});
