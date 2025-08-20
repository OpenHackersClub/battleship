import { describe, expect, it } from 'vitest';
import { getPositions, type Missle, type Ship } from '@/lib/domain/SeaObject';

describe('getPositions', () => {
  const makeShip = (overrides: Partial<Ship> = {}): Ship => ({
    id: overrides.id ?? 's1',
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    colorClass: overrides.colorClass ?? 'bg-red-500 border-red-600',
    length: overrides.length ?? 3,
    orientation: overrides.orientation ?? 0,
  });

  const makeMissle = (overrides: Partial<Missle> = {}): Missle => ({
    id: overrides.id ?? 'm1',
    x: overrides.x ?? 5,
    y: overrides.y ?? 6,
    firedBy: overrides.firedBy ?? 'player1',
    length: 1,
    orientation: 0,
  });

  it('returns horizontal positions for a horizontal ship', () => {
    const ship = makeShip({ x: 2, y: 3, length: 4, orientation: 0 });
    const positions = getPositions(ship);
    expect(positions).toEqual([
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 4, y: 3 },
      { x: 5, y: 3 },
    ]);
  });

  it('returns vertical positions for a vertical ship', () => {
    const ship = makeShip({ x: 1, y: 1, length: 3, orientation: 90 });
    const positions = getPositions(ship);
    expect(positions).toEqual([
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 1, y: 3 },
    ]);
  });

  it('returns a single position for a missle', () => {
    const missle = makeMissle({ x: 7, y: 8 });
    const positions = getPositions(missle);
    expect(positions).toEqual([{ x: 7, y: 8 }]);
  });
});
