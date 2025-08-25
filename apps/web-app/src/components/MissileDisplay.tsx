import type React from 'react';
import type { MissileResult, Ship } from '@battleship/domain';
import type { CellPixelSize } from '@/util/coordinates';
import { MissileRenderer } from './MissileRenderer';

interface MissileDisplayProps {
  missileResults: MissileResult[];
  ships: Ship[];
  cellPixelSize: CellPixelSize;
}

export const MissileDisplay: React.FC<MissileDisplayProps> = ({
  missileResults,
  ships,
  cellPixelSize,
}) => {
  return (
    <MissileRenderer
      missileResults={missileResults}
      ships={ships}
      cellPixelSize={cellPixelSize}
    />
  );
};
