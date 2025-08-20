import { isColliding } from './collision';
import type { Ship } from './SeaObject';

// decouple the shipcolor classes

export const createInitialShips = ({
  player,
  colSize,
  rowSize,
  shipCount = 5,
}: {
  player: string;
  colSize: number;
  rowSize: number;
  shipCount?: number;
}): Ship[] => {
  const positionsFrom = (startIndex: number) =>
    Array.from({ length: colSize * rowSize }, (_, k) => {
      const idx = (startIndex + k) % (colSize * rowSize);
      return { x: idx % colSize, y: Math.floor(idx / colSize) };
    });

  return Array.from({ length: shipCount }).reduce<Ship[]>((acc, _, i) => {
    const baseship: Ship = {
      id: String(i + 1),
      length: i + 1,
      x: 0,
      y: 0,
      player,
      orientation: i % 2 === 0 ? 0 : 90,
    };

    const occupiedCols = baseship.orientation === 0 ? baseship.length : 1;
    const occupiedRows = baseship.orientation === 90 ? baseship.length : 1;
    const maxX = colSize - occupiedCols;
    const maxY = rowSize - occupiedRows;

    const startIndex = i * colSize; // prefer starting on row i
    const candidate = positionsFrom(startIndex)
      .filter(({ x, y }) => x <= maxX && y <= maxY)
      .map(({ x, y }) => ({ ...baseship, x, y }))
      .find((ship) => !isColliding(ship, acc)) || { x: 0, y: 0 };

    acc.push({ ...baseship, x: candidate.x, y: candidate.y });
    return acc;
  }, []);
};
