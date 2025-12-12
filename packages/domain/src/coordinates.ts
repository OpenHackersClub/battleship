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

export const stringifyCoordinates = (x: number, y: number) => `[${x},${y}]`;
