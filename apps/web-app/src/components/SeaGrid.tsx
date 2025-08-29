import type { MissileResult, Ship } from '@battleship/domain';
import { type DragDropEvents, DragDropProvider } from '@dnd-kit/react';
import React, { useEffect, useRef, useState } from 'react';
import { useMissileHitDetection } from '@/hooks/useMissileHitDetection';
import type { CellPixelSize } from '@/util/coordinates';
import { GAME_CONFIG } from './GameStateProvider';
import { MissileCellCross, MissileCellDot } from './MissileVisuals';

// Using Tailwind CSS default color classes
export const SHIP_COLOR_CLASSES = [
  'bg-red-500 border-red-600', // Vibrant red
  'bg-teal-500 border-teal-600', // Modern teal
  'bg-orange-500 border-blue-600', //
  'bg-amber-400 border-amber-500', // Bright amber
  'bg-violet-400 border-violet-500', // Rich violet
];

const Grid = React.forwardRef<
  HTMLDivElement,
  {
    rowSize: number;
    colSize: number;
    children: React.ReactNode;
    missileResults?: MissileResult[];
    ships?: Ship[];
    onCellClick?: (x: number, y: number) => void;
  }
>(({ rowSize, colSize, children, missileResults = [], ships = [], onCellClick }, ref) => {
  // Generate grid column and row classes based on cellCount
  const gridColsClass = `grid-cols-${colSize}`;
  const { checkMissileHit } = useMissileHitDetection();

  // Create a map of missile results by coordinates for efficient lookup
  const missileMap = new Map<string, MissileResult>();
  missileResults.forEach((missile) => {
    missileMap.set(`${missile.x}-${missile.y}`, missile);
  });

  return (
    <div ref={ref} className={`relative bg-white grid ${gridColsClass} gap-2`}>
      {/* Generate grid cells */}
      {Array.from({ length: rowSize * colSize }, (_, i) => {
        const x = i % colSize;
        const y = Math.floor(i / colSize);
        const missile = missileMap.get(`${x}-${y}`);
        const isHit = missile ? checkMissileHit(missile, ships) : false;

        return (
          <button
            key={`cell-${x}-${y}`}
            type="button"
            className="aspect-square border border-blue-200 bg-blue-100 relative flex items-center justify-center cursor-pointer hover:bg-blue-400/40 hover:border-blue-500 z-"
            onClick={() => onCellClick?.(x, y)}
          >
            {missile &&
              (isHit ? (
                <MissileCellCross id={missile.id} x={missile.x} y={missile.y} inline={true} />
              ) : (
                <MissileCellDot id={missile.id} x={missile.x} y={missile.y} inline={true} />
              ))}
          </button>
        );
      })}
      {/* Overlay for draggable items using the same grid structure. No overlay if clickable */}
      {!onCellClick && (
        <div className={`absolute inset-0 grid ${gridColsClass} gap-2 z-10`}>{children}</div>
      )}
    </div>
  );
});

type SeaGridChildrenArg = {
  cellPixelSize: CellPixelSize;
  gridRef: React.RefObject<HTMLDivElement | null>;
};

type SeaGridProps = {
  player: string;
  rowSize?: number;
  colSize?: number;
  className?: string;
  onDragEnd?: DragDropEvents['dragend'];
  children?: React.ReactNode | ((arg: SeaGridChildrenArg) => React.ReactNode);
  missileResults?: MissileResult[];
  ships?: Ship[];
  onCellClick?: (x: number, y: number) => void;
};

export const SeaGrid: React.FC<SeaGridProps> = ({
  player: _player,
  rowSize: rowSizeProp = GAME_CONFIG.rowSize,
  colSize: colSizeProp = GAME_CONFIG.colSize,
  className,
  onDragEnd,
  children,
  missileResults,
  ships,
  onCellClick,
}) => {
  const [rowSize, _setRowSize] = useState(rowSizeProp);
  const [colSize, _setColSize] = useState(colSizeProp);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const [cellPixelSize, setCellPixelSize] = useState<CellPixelSize>({
    width: 0,
    height: 0,
    gapX: 0,
    gapY: 0,
  });

  //   Here we want the ship to be repsonsive as grid cell
  //   TODO use tailwind width class after detect pixel width for once to move per transform.x
  useEffect(() => {
    if (!gridRef.current) return;
    const element = gridRef.current;
    const compute = () => {
      const rect = element.getBoundingClientRect();
      const styles = getComputedStyle(element);
      const gapX = parseFloat(styles.columnGap || styles.gap || '0') || 0;
      const gapY = parseFloat(styles.rowGap || styles.gap || '0') || 0;
      const totalGapX = gapX * Math.max(0, colSize - 1);
      const totalGapY = gapY * Math.max(0, rowSize - 1);
      const widthPerCell = (rect.width - totalGapX) / colSize;
      const heightPerCell = (rect.height - totalGapY) / rowSize;
      setCellPixelSize({ width: widthPerCell, height: heightPerCell, gapX, gapY });
    };
    compute();
    const ro = new ResizeObserver(() => compute());
    ro.observe(element);
    return () => ro.disconnect();
  }, [rowSize, colSize]);

  const renderedChildren =
    typeof children === 'function'
      ? (children as (arg: SeaGridChildrenArg) => React.ReactNode)({
          cellPixelSize,
          gridRef,
        })
      : children;

  return (
    <div className={'p-5 ' + (className || '')}>
      <DragDropProvider onDragEnd={onDragEnd}>
        <div className="relative">
          <Grid
            ref={gridRef}
            rowSize={rowSize}
            colSize={colSize}
            missileResults={missileResults}
            ships={ships}
            onCellClick={onCellClick}
          >
            {renderedChildren}
          </Grid>
        </div>
      </DragDropProvider>
    </div>
  );
};
