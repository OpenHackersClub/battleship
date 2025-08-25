import { GRID_CONSTANTS } from '@battleship/domain';
import { stringifyCoordinates as stringifyCoordinatesFromSchema } from '@battleship/schema/utils';

export const stringifyCoordinates = stringifyCoordinatesFromSchema;

export type CellPixelSize = {
  width: number;
  height: number;
  gapX: number;
  gapY: number;
};

export const calculateCellPosition = (x: number, y: number, cellPixelSize: CellPixelSize) => ({
  left: x * (cellPixelSize.width + cellPixelSize.gapX),
  top: y * (cellPixelSize.height + cellPixelSize.gapY),
});

export const getCellStep = (cellPixelSize: CellPixelSize) => ({
  stepX: cellPixelSize.width + cellPixelSize.gapX,
  stepY: cellPixelSize.height + cellPixelSize.gapY,
});

export const calculateShipDimensions = (
  length: number,
  orientation: 0 | 90,
  cellPixelSize: CellPixelSize
) => ({
  width:
    orientation === 0
      ? length * cellPixelSize.width + (length - 1) * cellPixelSize.gapX
      : cellPixelSize.width,
  height:
    orientation === 90
      ? length * cellPixelSize.height + (length - 1) * cellPixelSize.gapY
      : cellPixelSize.height,
});

export const computeCellFromMouseEvent = (
  event: React.MouseEvent<Element>,
  gridElement: HTMLDivElement | null,
  cellPixelSize: CellPixelSize,
  cols = GRID_CONSTANTS.DEFAULT_COLS,
  rows = GRID_CONSTANTS.DEFAULT_ROWS
): { x: number; y: number } | null => {
  if (!gridElement) return null;
  const rect = gridElement.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;
  const { stepX, stepY } = getCellStep(cellPixelSize);
  if (stepX <= 0 || stepY <= 0) return null;
  const x = Math.max(0, Math.min(cols - 1, Math.floor(offsetX / stepX)));
  const y = Math.max(0, Math.min(rows - 1, Math.floor(offsetY / stepY)));
  return { x, y };
};
