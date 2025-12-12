import { describe, expect, it } from 'vitest';
import {
  type CellPixelSize,
  calculateCellPosition,
  calculateShipDimensions,
  getCellStep,
} from './coordinates';

describe('coordinate utilities', () => {
  const mockCellSize: CellPixelSize = {
    width: 30,
    height: 30,
    gapX: 2,
    gapY: 2,
  };

  describe('calculateCellPosition', () => {
    it('calculates position for cell at origin', () => {
      const position = calculateCellPosition(0, 0, mockCellSize);
      expect(position).toEqual({ left: 0, top: 0 });
    });

    it('calculates position for cell at (1,1)', () => {
      const position = calculateCellPosition(1, 1, mockCellSize);
      expect(position).toEqual({
        left: 1 * (30 + 2), // 32
        top: 1 * (30 + 2), // 32
      });
    });

    it('calculates position for cell at (3,2)', () => {
      const position = calculateCellPosition(3, 2, mockCellSize);
      expect(position).toEqual({
        left: 3 * (30 + 2), // 96
        top: 2 * (30 + 2), // 64
      });
    });
  });

  describe('getCellStep', () => {
    it('calculates step size including gaps', () => {
      const step = getCellStep(mockCellSize);
      expect(step).toEqual({
        stepX: 32, // 30 + 2
        stepY: 32, // 30 + 2
      });
    });

    it('handles different width and height', () => {
      const differentSize: CellPixelSize = {
        width: 40,
        height: 25,
        gapX: 3,
        gapY: 1,
      };
      const step = getCellStep(differentSize);
      expect(step).toEqual({
        stepX: 43, // 40 + 3
        stepY: 26, // 25 + 1
      });
    });
  });

  describe('calculateShipDimensions', () => {
    describe('horizontal ships (orientation 0)', () => {
      it('calculates dimensions for length 1 horizontal ship', () => {
        const dimensions = calculateShipDimensions(1, 0, mockCellSize);
        expect(dimensions).toEqual({
          width: 30, // 1 * 30 + (1-1) * 2
          height: 30,
        });
      });

      it('calculates dimensions for length 3 horizontal ship', () => {
        const dimensions = calculateShipDimensions(3, 0, mockCellSize);
        expect(dimensions).toEqual({
          width: 94, // 3 * 30 + 2 * 2 = 90 + 4
          height: 30,
        });
      });

      it('calculates dimensions for length 5 horizontal ship', () => {
        const dimensions = calculateShipDimensions(5, 0, mockCellSize);
        expect(dimensions).toEqual({
          width: 158, // 5 * 30 + 4 * 2 = 150 + 8
          height: 30,
        });
      });
    });

    describe('vertical ships (orientation 90)', () => {
      it('calculates dimensions for length 1 vertical ship', () => {
        const dimensions = calculateShipDimensions(1, 90, mockCellSize);
        expect(dimensions).toEqual({
          width: 30,
          height: 30, // 1 * 30 + (1-1) * 2
        });
      });

      it('calculates dimensions for length 3 vertical ship', () => {
        const dimensions = calculateShipDimensions(3, 90, mockCellSize);
        expect(dimensions).toEqual({
          width: 30,
          height: 94, // 3 * 30 + 2 * 2 = 90 + 4
        });
      });

      it('calculates dimensions for length 5 vertical ship', () => {
        const dimensions = calculateShipDimensions(5, 90, mockCellSize);
        expect(dimensions).toEqual({
          width: 30,
          height: 158, // 5 * 30 + 4 * 2 = 150 + 8
        });
      });
    });

    describe('edge cases', () => {
      it('handles zero gaps', () => {
        const noGapSize: CellPixelSize = {
          width: 20,
          height: 20,
          gapX: 0,
          gapY: 0,
        };

        const horizontalDims = calculateShipDimensions(3, 0, noGapSize);
        expect(horizontalDims).toEqual({
          width: 60, // 3 * 20 + 2 * 0
          height: 20,
        });

        const verticalDims = calculateShipDimensions(3, 90, noGapSize);
        expect(verticalDims).toEqual({
          width: 20,
          height: 60, // 3 * 20 + 2 * 0
        });
      });
    });
  });
});
