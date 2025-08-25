import type React from 'react';
import { MISSILE_CONSTANTS } from '@/util/missile-utils';

interface MissileCrossProps {
  id: string;
  left: number;
  top: number;
  size?: number;
  thickness?: number;
  color?: string;
}

export const MissileCross: React.FC<MissileCrossProps> = ({
  id,
  left,
  top,
  size = MISSILE_CONSTANTS.CROSS.SIZE,
  thickness = MISSILE_CONSTANTS.CROSS.THICKNESS,
  color = MISSILE_CONSTANTS.CROSS.COLOR,
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

interface MissileDotProps {
  id: string;
  left: number;
  top: number;
  size?: number;
  color?: string;
  shadow?: string;
}

export const MissileDot: React.FC<MissileDotProps> = ({
  id,
  left,
  top,
  size = MISSILE_CONSTANTS.DOT.SIZE,
  color = MISSILE_CONSTANTS.DOT.COLOR,
  shadow = MISSILE_CONSTANTS.DOT.SHADOW,
}) => (
  <div
    key={`missile-dot-${id}`}
    className="absolute z-10 pointer-events-none"
    style={{
      left,
      top,
      width: size,
      height: size,
      borderRadius: '9999px',
      backgroundColor: color,
      boxShadow: shadow,
    }}
  />
);
