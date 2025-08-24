import { isColliding } from '@battleship/domain';
import type React from 'react';
import type { CellPixelSize } from './SeaGrid';

interface MissileCrossProps {
  id: string;
  left: number;
  top: number;
  size?: number;
  thickness?: number;
  color?: string;
}

const MissileCross: React.FC<MissileCrossProps> = ({
  id,
  left,
  top,
  size = 14,
  thickness = 2,
  color = '#991b1b',
}) => (
  <div key={`missile-cross-${id}`} className="absolute z-10 pointer-events-none">
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: size,
        height: thickness,
        backgroundColor: color,
        transform: 'rotate(45deg)',
        transformOrigin: 'center',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: size,
        height: thickness,
        backgroundColor: color,
        transform: 'rotate(-45deg)',
        transformOrigin: 'center',
      }}
    />
  </div>
);

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
  return (
    <>
      {missileResults.map((m) => {
        const missileAsSeaObject = {
          id: m.id,
          x: m.x,
          y: m.y,
          length: 1,
          orientation: 0 as const,
          player: m.player,
        };
        const collisionPoint = isColliding(missileAsSeaObject, ships);
        const isHit = !!collisionPoint;

        if (isHit) {
          const size = 14;
          const thickness = 2;
          const leftCross =
            m.x * (cellPixelSize.width + cellPixelSize.gapX) + (cellPixelSize.width - size) / 2;
          const topCross =
            m.y * (cellPixelSize.height + cellPixelSize.gapY) +
            (cellPixelSize.height - thickness) / 2;
          return (
            <MissileCross
              key={`missile-cross-${m.id}`}
              id={m.id}
              left={leftCross}
              top={topCross}
              size={size}
              thickness={thickness}
            />
          );
        }
        const dotSize = 10;
        const mLeft =
          m.x * (cellPixelSize.width + cellPixelSize.gapX) + (cellPixelSize.width - dotSize) / 2;
        const mTop =
          m.y * (cellPixelSize.height + cellPixelSize.gapY) + (cellPixelSize.height - dotSize) / 2;
        return (
          <div
            key={`missile-dot-${m.id}`}
            className="absolute z-10 pointer-events-none"
            style={{
              left: mLeft,
              top: mTop,
              width: dotSize,
              height: dotSize,
              borderRadius: '9999px',
              backgroundColor: '#1e3a8a',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.2)',
            }}
          />
        );
      })}
    </>
  );
};
