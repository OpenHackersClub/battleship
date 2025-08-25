import { useCallback, useState } from 'react';
import { type CellPixelSize, computeCellFromMouseEvent } from '@/util/coordinates';

type Cell = { x: number; y: number };

export const useGridInteraction = () => {
  const [hoverCell, setHoverCell] = useState<Cell | null>(null);

  const createMouseMoveHandler = useCallback(
    (gridRef: React.RefObject<HTMLDivElement | null>, cellPixelSize: CellPixelSize) =>
      (e: React.MouseEvent) => {
        const cell = computeCellFromMouseEvent(e, gridRef.current, cellPixelSize);
        setHoverCell(cell);
      },
    []
  );

  const handleMouseLeave = useCallback(() => setHoverCell(null), []);

  const createClickHandler = useCallback(
    (
      gridRef: React.RefObject<HTMLDivElement | null>,
      cellPixelSize: CellPixelSize,
      onCellClick: (cell: Cell) => void
    ) =>
      (e: React.MouseEvent) => {
        const cell = computeCellFromMouseEvent(e, gridRef.current, cellPixelSize);
        if (cell) {
          onCellClick(cell);
        }
      },
    []
  );

  return {
    hoverCell,
    createMouseMoveHandler,
    handleMouseLeave,
    createClickHandler,
  };
};
