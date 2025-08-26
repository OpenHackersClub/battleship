import {
  type CellPixelSize,
  GRID_CONSTANTS,
  getCellStep,
  stringifyCoordinates,
} from '@battleship/domain';

export {
  type CellPixelSize,
  calculateCellPosition,
  calculateShipDimensions,
  getCellStep,
} from '@battleship/domain';

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
