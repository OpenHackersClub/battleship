import { GRID_CONSTANTS, getCellStep, type CellPixelSize } from '@battleship/domain';
import { stringifyCoordinates as stringifyCoordinatesFromSchema } from '@battleship/schema/utils';

export const stringifyCoordinates = stringifyCoordinatesFromSchema;

export { type CellPixelSize, calculateCellPosition, getCellStep, calculateShipDimensions } from '@battleship/domain';

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
