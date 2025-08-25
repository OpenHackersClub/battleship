import type React from 'react';
import type { MissileResult, Ship } from '@battleship/domain';
import { useMissileHitDetection } from '@/hooks/useMissileHitDetection';
import type { CellPixelSize } from '@/util/coordinates';
import { calculateMissileCrossPosition, calculateMissileDotPosition } from '@/util/missile-utils';
import { MissileCross, MissileDot } from './MissileVisuals';

export interface MissileRendererProps {
  missileResults: MissileResult[];
  ships: Ship[];
  cellPixelSize: CellPixelSize;
}

export const MissileRenderer: React.FC<MissileRendererProps> = ({
  missileResults,
  ships,
  cellPixelSize,
}) => {
  const { checkMissileHit } = useMissileHitDetection();

  return (
    <>
      {(missileResults ?? []).map((m) => {
        const isHit = checkMissileHit(m, ships);

        if (isHit) {
          const { left, top } = calculateMissileCrossPosition({
            x: m.x,
            y: m.y,
            cellPixelSize,
          });
          return <MissileCross key={`missile-cross-${m.id}`} id={m.id} left={left} top={top} />;
        }

        const { left, top } = calculateMissileDotPosition({
          x: m.x,
          y: m.y,
          cellPixelSize,
        });
        return <MissileDot key={`missile-dot-${m.id}`} id={m.id} left={left} top={top} />;
      })}
    </>
  );
};