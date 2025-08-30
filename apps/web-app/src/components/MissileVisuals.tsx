import { MISSILE_CONSTANTS } from '@battleship/domain';
import type React from 'react';

interface MissileCellCrossProps {
  id: string;
  x: number;
  y: number;
  colSize?: number;
  size?: number;
  thickness?: number;
  color?: string;
  inline?: boolean;
}

export const MissileCellCross: React.FC<MissileCellCrossProps> = ({
  id,
  x,
  y,
  size = MISSILE_CONSTANTS.CROSS.SIZE,
  thickness = MISSILE_CONSTANTS.CROSS.THICKNESS,
  color = MISSILE_CONSTANTS.CROSS.COLOR,
  inline = false,
}) => {
  const gridColumn = x + 1;
  const gridRow = y + 1;

  if (inline) {
    return (
      <div className="relative">
        <div
          style={{
            width: size,
            height: thickness,
            backgroundColor: color,
            transform: 'rotate(45deg)',
            transformOrigin: 'center',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            width: size,
            height: thickness,
            backgroundColor: color,
            transform: 'rotate(-45deg)',
            transformOrigin: 'center',
          }}
        />
      </div>
    );
  }

  return (
    <div
      key={`missile-cross-${id}`}
      className="z-10 pointer-events-none flex items-center justify-center"
      style={{
        gridColumn,
        gridRow,
      }}
    >
      <div className="relative">
        <div
          style={{
            width: size,
            height: thickness,
            backgroundColor: color,
            transform: 'rotate(45deg)',
            transformOrigin: 'center',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            width: size,
            height: thickness,
            backgroundColor: color,
            transform: 'rotate(-45deg)',
            transformOrigin: 'center',
          }}
        />
      </div>
    </div>
  );
};

interface MissileCellDotProps {
  id: string;
  x: number;
  y: number;
  size?: number;
  color?: string;
  shadow?: string;
  inline?: boolean;
}

export const MissileCellDot: React.FC<MissileCellDotProps> = ({
  id,
  x,
  y,
  size = MISSILE_CONSTANTS.DOT.SIZE,
  color = MISSILE_CONSTANTS.DOT.COLOR,
  shadow = MISSILE_CONSTANTS.DOT.SHADOW,
  inline = false,
}) => {
  const gridColumn = x + 1;
  const gridRow = y + 1;

  if (inline) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '9999px',
          backgroundColor: color,
          boxShadow: shadow,
        }}
      />
    );
  }

  return (
    <div
      key={`missile-dot-${id}`}
      className="z-10 pointer-events-none flex items-center justify-center"
      style={{
        gridColumn,
        gridRow,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '9999px',
          backgroundColor: color,
          boxShadow: shadow,
        }}
      />
    </div>
  );
};
