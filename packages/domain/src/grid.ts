import { isColliding } from './collision';
import type { Ship } from './SeaObject';

// decouple the shipcolor classes

export const createInitialShips = ({
  player,
  colSize,
  rowSize,
  shipCount = 3,
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
    const orientation = Math.random() < 0.5 ? 0 : 90;
    const baseship: Ship = {
      id: crypto.randomUUID(),
      length: Math.min(i + 1, 3),
      x: 0,
      y: 0,
      player,
      orientation,
    };

    const occupiedCols = baseship.orientation === 0 ? baseship.length : 1;
    const occupiedRows = baseship.orientation === 90 ? baseship.length : 1;
    const maxX = colSize - occupiedCols;
    const maxY = rowSize - occupiedRows;

    const startIndex = Math.floor(Math.random() * (colSize * rowSize));
    const candidate = positionsFrom(startIndex)
      .filter(({ x, y }) => x <= maxX && y <= maxY)
      .map(({ x, y }) => ({ ...baseship, x, y }))
      .find((ship) => !isColliding(ship, acc)) || { x: 0, y: 0 };

    acc.push({ ...baseship, x: candidate.x, y: candidate.y });
    return acc;
  }, []);
};

/**
 * Server as fallback strategy that find a empty target
 *
 * TODO: Decouple filtering and strategy
 *
 * @param gridSize - Size of the grid
 * @param firedCoordinates - Set of already fired coordinate strings
 * @returns Random available coordinate or null if none available
 */
export const pickEmptyTarget = ({
  rowSize,
  colSize,
  firedCoordinates,
}: {
  rowSize: number;
  colSize: number;
  firedCoordinates: Set<string>;
}) => {
  const availableCoordinates = Array.from({ length: rowSize }, (_, x) =>
    Array.from({ length: colSize }, (_, y) => ({ x, y }))
  )
    .flat()
    .filter((coord) => !firedCoordinates.has(`${coord.x},${coord.y}`));

  return availableCoordinates.length === 0
    ? null
    : availableCoordinates[Math.floor(Math.random() * availableCoordinates.length)];
};
