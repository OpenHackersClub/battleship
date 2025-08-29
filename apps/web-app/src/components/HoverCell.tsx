import type React from 'react';
import { type CellPixelSize, calculateCellPosition } from '@/util/coordinates';

interface HoverCellProps {
  cell: { x: number; y: number } | null;
  cellPixelSize: CellPixelSize;
  className?: string;
}

export const HoverCell: React.FC<HoverCellProps> = ({
  cell,
  cellPixelSize,
  className = 'absolute bg-blue-400/40 border border-blue-500 pointer-events-none',
}) => {
  if (!cell) return null;

  const { left, top } = calculateCellPosition(cell.x, cell.y, cellPixelSize);
  const { width, height } = cellPixelSize;

  return <div className={className} style={{ left, top, width, height }} />;
};
