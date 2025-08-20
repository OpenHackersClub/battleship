import type React from 'react';
import { createContext, useContext, useMemo, useState } from 'react';
import { isColliding } from '@/lib/domain/collision';
import { type Ship, shipColorClasses } from '../lib/domain/SeaObject';

const SHIP_COUNT = 5;

const createInitialships = (colSize: number, rowSize: number): Ship[] => {
  const positionsFrom = (startIndex: number) =>
    Array.from({ length: colSize * rowSize }, (_, k) => {
      const idx = (startIndex + k) % (colSize * rowSize);
      return { x: idx % colSize, y: Math.floor(idx / colSize) };
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

const initialships: Ship[] = createInitialships(10, 10);

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
