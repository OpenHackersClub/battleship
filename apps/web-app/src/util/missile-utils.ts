import { MISSILE_CONSTANTS } from '@battleship/domain';
import { type CellPixelSize, calculateCellPosition } from './coordinates';

export type MissileVisualProps = {
  x: number;
  y: number;
  cellPixelSize: CellPixelSize;
};

export const calculateMissilePosition = (
  { x, y, cellPixelSize }: MissileVisualProps,
  elementSize: number
) => {
  const { left: cellLeft, top: cellTop } = calculateCellPosition(x, y, cellPixelSize);
  return {
    left: cellLeft + (cellPixelSize.width - elementSize) / 2,
    top: cellTop + (cellPixelSize.height - elementSize) / 2,
  };
};

export const calculateMissileCrossPosition = (props: MissileVisualProps) => {
  const { left, top } = calculateMissilePosition(props, MISSILE_CONSTANTS.CROSS.SIZE);
  return {
    left,
    top: top + (MISSILE_CONSTANTS.CROSS.SIZE - MISSILE_CONSTANTS.CROSS.THICKNESS) / 2,
  };
};

export const calculateMissileDotPosition = (props: MissileVisualProps) => {
  return calculateMissilePosition(props, MISSILE_CONSTANTS.DOT.SIZE);
};
