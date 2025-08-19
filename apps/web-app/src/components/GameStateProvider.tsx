import type React from 'react';
import { createContext, useContext, useMemo, useState } from 'react';
import { type Ship, shipColorClasses } from './Ship';

// Initialize 5 ships with lengths 1..5, avoiding collisions (functional)
const DEFAULT_ROWS = 10;
const DEFAULT_COLS = 10;

const SHIP_COUNT = 5;

// Function to get all coordinate pairs occupied by a ship
const getshipCoordinates = (ship: Ship): Set<string> => {
  const coordinates = new Set<string>();
  const width = ship.orientation === 0 ? ship.length : 1;
  const height = ship.orientation === 90 ? ship.length : 1;

  for (let x = ship.x; x < ship.x + width; x++) {
    for (let y = ship.y; y < ship.y + height; y++) {
      coordinates.add(`${x},${y}`);
    }
  }

  return coordinates;
};

// Function to check if two coordinate sets have any intersection
const checkIsCoordiantesIntersect = (set1: Set<string>, set2: Set<string>): boolean => {
  return Array.from(set1).some((coord) => set2.has(coord));
};

// Function to check if a ship would collide with any other ships at a given position
export const isShipColliding = (
  targetship: Ship,
  newX: number,
  newY: number,
  allships: Ship[]
): boolean => {
  const testship = { ...targetship, x: newX, y: newY };
  const testCoordinates = getshipCoordinates(testship);

  return allships.some((ship) => {
    if (ship.id === targetship.id) return false;
    const shipCoordinates = getshipCoordinates(ship);
    return checkIsCoordiantesIntersect(testCoordinates, shipCoordinates);
  });
};

const createInitialships = (): Ship[] => {
  const positionsFrom = (startIndex: number) =>
    Array.from({ length: DEFAULT_ROWS * DEFAULT_COLS }, (_, k) => {
      const idx = (startIndex + k) % (DEFAULT_ROWS * DEFAULT_COLS);
      return { x: idx % DEFAULT_COLS, y: Math.floor(idx / DEFAULT_COLS) };
    });

  return Array.from({ length: SHIP_COUNT }).reduce<Ship[]>((acc, _, i) => {
    const baseship: Ship = {
      id: String(i + 1),
      length: i + 1,
      x: 0,
      y: 0,
      colorClass: shipColorClasses[i % shipColorClasses.length],
      orientation: i % 2 === 0 ? 0 : 90,
    };

    const occupiedCols = baseship.orientation === 0 ? baseship.length : 1;
    const occupiedRows = baseship.orientation === 90 ? baseship.length : 1;
    const maxX = DEFAULT_COLS - occupiedCols;
    const maxY = DEFAULT_ROWS - occupiedRows;

    const startIndex = i * DEFAULT_COLS; // prefer starting on row i
    const candidate = positionsFrom(startIndex)
      .filter(({ x, y }) => x <= maxX && y <= maxY)
      .find(({ x, y }) => !isShipColliding(baseship, x, y, acc)) || { x: 0, y: 0 };

    acc.push({ ...baseship, x: candidate.x, y: candidate.y });
    return acc;
  }, []);
};

const initialships: Ship[] = createInitialships();

type GameStateContextValue = {
  ships: Ship[];
  setShips: React.Dispatch<React.SetStateAction<Ship[]>>;
};

const GameStateContext = createContext<GameStateContextValue | undefined>(undefined);

export function useShips(): GameStateContextValue {
  const ctx = useContext(GameStateContext);
  if (!ctx) throw new Error('useShips must be used within a ShipsProvider');
  return ctx;
}

export function GameStateProvider({ children }: { children: React.ReactNode }) {
  const [ships, setShips] = useState<Ship[]>(initialships);
  const value = useMemo(() => ({ ships, setShips }), [ships]);
  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>;
}
