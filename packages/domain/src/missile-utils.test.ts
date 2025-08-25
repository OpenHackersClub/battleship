import { describe, expect, it } from 'vitest';
import { 
  calculateMissilePosition,
  calculateMissileCrossPosition,
  calculateMissileDotPosition,
  type MissileVisualProps
} from './missile-utils';
import { MISSILE_CONSTANTS } from './types';
import type { CellPixelSize } from './coordinates';

describe('missile utilities', () => {
  const mockCellSize: CellPixelSize = {
    width: 30,
    height: 30,
    gapX: 2,
    gapY: 2,
  };

  const mockMissileProps: MissileVisualProps = {
    x: 2,
    y: 1,
    cellPixelSize: mockCellSize,
  };

  describe('calculateMissilePosition', () => {
    it('centers missile in cell for square element', () => {
      const elementSize = 10;
      const position = calculateMissilePosition(mockMissileProps, elementSize);
      
      // Cell position: left = 2 * (30 + 2) = 64, top = 1 * (30 + 2) = 32
      // Centered: left = 64 + (30 - 10) / 2 = 64 + 10 = 74
      // Centered: top = 32 + (30 - 10) / 2 = 32 + 10 = 42
      expect(position).toEqual({
        left: 74,
        top: 42
      });
    });

    it('centers missile for element larger than cell', () => {
      const elementSize = 40;
      const position = calculateMissilePosition(mockMissileProps, elementSize);
      
      // Cell position: left = 64, top = 32
      // Centered: left = 64 + (30 - 40) / 2 = 64 - 5 = 59
      // Centered: top = 32 + (30 - 40) / 2 = 32 - 5 = 27
      expect(position).toEqual({
        left: 59,
        top: 27
      });
    });

    it('works with element same size as cell', () => {
      const elementSize = 30;
      const position = calculateMissilePosition(mockMissileProps, elementSize);
      
      // Cell position: left = 64, top = 32
      // Centered: left = 64 + (30 - 30) / 2 = 64
      // Centered: top = 32 + (30 - 30) / 2 = 32
      expect(position).toEqual({
        left: 64,
        top: 32
      });
    });

    it('works with origin cell (0,0)', () => {
      const propsAtOrigin: MissileVisualProps = {
        x: 0,
        y: 0,
        cellPixelSize: mockCellSize,
      };
      const elementSize = 10;
      const position = calculateMissilePosition(propsAtOrigin, elementSize);
      
      // Cell position: left = 0, top = 0
      // Centered: left = 0 + (30 - 10) / 2 = 10
      // Centered: top = 0 + (30 - 10) / 2 = 10
      expect(position).toEqual({
        left: 10,
        top: 10
      });
    });
  });

  describe('calculateMissileCrossPosition', () => {
    it('calculates cross position using MISSILE_CONSTANTS', () => {
      const position = calculateMissileCrossPosition(mockMissileProps);
      const crossSize = MISSILE_CONSTANTS.CROSS.SIZE;
      const thickness = MISSILE_CONSTANTS.CROSS.THICKNESS;
      
      // Base missile position with cross size
      const baseMissilePos = calculateMissilePosition(mockMissileProps, crossSize);
      
      // Cross-specific adjustment for thickness
      const expectedTop = baseMissilePos.top + (crossSize - thickness) / 2;
      
      expect(position).toEqual({
        left: baseMissilePos.left,
        top: expectedTop
      });
    });

    it('adjusts position based on cross thickness', () => {
      // Test that the cross position differs from regular missile position
      const crossPos = calculateMissileCrossPosition(mockMissileProps);
      const regularPos = calculateMissilePosition(mockMissileProps, MISSILE_CONSTANTS.CROSS.SIZE);
      
      expect(crossPos.left).toBe(regularPos.left);
      expect(crossPos.top).not.toBe(regularPos.top); // Should be adjusted for thickness
    });
  });

  describe('calculateMissileDotPosition', () => {
    it('calculates dot position using MISSILE_CONSTANTS', () => {
      const position = calculateMissileDotPosition(mockMissileProps);
      const dotSize = MISSILE_CONSTANTS.DOT.SIZE;
      
      // Should be same as regular missile position with dot size
      const expectedPosition = calculateMissilePosition(mockMissileProps, dotSize);
      
      expect(position).toEqual(expectedPosition);
    });

    it('produces different position than cross due to different size', () => {
      const dotPos = calculateMissileDotPosition(mockMissileProps);
      const crossPos = calculateMissileCrossPosition(mockMissileProps);
      
      // Positions should differ because dot and cross have different sizes
      expect(dotPos).not.toEqual(crossPos);
    });
  });

  describe('integration with different cell sizes', () => {
    const largeCellSize: CellPixelSize = {
      width: 50,
      height: 40,
      gapX: 5,
      gapY: 3,
    };

    const largeCellProps: MissileVisualProps = {
      x: 1,
      y: 1,
      cellPixelSize: largeCellSize,
    };

    it('works with non-square cells', () => {
      const dotPos = calculateMissileDotPosition(largeCellProps);
      const crossPos = calculateMissileCrossPosition(largeCellProps);
      
      // Should handle non-square cells correctly
      expect(typeof dotPos.left).toBe('number');
      expect(typeof dotPos.top).toBe('number');
      expect(typeof crossPos.left).toBe('number');
      expect(typeof crossPos.top).toBe('number');
      
      // Positions should be different
      expect(dotPos).not.toEqual(crossPos);
    });

    it('centers properly in larger cells', () => {
      const elementSize = 10;
      const position = calculateMissilePosition(largeCellProps, elementSize);
      
      // Cell position: left = 1 * (50 + 5) = 55, top = 1 * (40 + 3) = 43
      // Centered: left = 55 + (50 - 10) / 2 = 55 + 20 = 75
      // Centered: top = 43 + (40 - 10) / 2 = 43 + 15 = 58
      expect(position).toEqual({
        left: 75,
        top: 58
      });
    });
  });
});