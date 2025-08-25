import type React from 'react';
import { useMissileHitDetection } from '@/hooks/useMissileHitDetection';
import type { CellPixelSize } from '@/util/coordinates';
import { calculateMissileCrossPosition, calculateMissileDotPosition } from '@/util/missile-utils';
import { MissileCross, MissileDot } from './MissileVisuals';

interface MissileResult {
  id: string;
  x: number;
  y: number;
  player: string;
}

interface Ship {
  id: string;
  x: number;
  y: number;
  length: number;
  orientation: 0 | 90;
  player: string;
}

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
  const { checkMissileHit } = useMissileHitDetection();

  return (
    <>
      {missileResults.map((m) => {
        const isHit = checkMissileHit(m, ships);

        if (isHit) {
          const { left, top } = calculateMissileCrossPosition({
            x: m.x,
            y: m.y,
            cellPixelSize,
          });
          return (
            <MissileCross key={`missile-cross-${m.id}`} id={m.id} left={left} top={top} />
          );
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
