import { SnapModifier } from '@dnd-kit/abstract/modifiers';
import { RestrictToElement } from '@dnd-kit/dom/modifiers';
import { type DragDropEvents, DragDropProvider, useDraggable } from '@dnd-kit/react';
import React, { useEffect, useRef, useState } from 'react';
import { isColliding } from '@/lib/domain/collision';
import { useShips } from './GameStateProvider';

const Grid = React.forwardRef<
  HTMLDivElement,
  { rowSize: number; colSize: number; children: React.ReactNode }
>(({ rowSize, colSize, children }, ref) => {
  // Generate grid column and row classes based on cellCount
  const gridColsClass = `grid-cols-${colSize}`;

  return (
    <div ref={ref} className={`relative bg-white grid ${gridColsClass} gap-2`}>
      {/* Generate grid cells */}
      {Array.from({ length: rowSize * colSize }, (_, i) => {
        const x = i % colSize;
        const y = Math.floor(i / colSize);
        return (
          <div
            key={`cell-${x}-${y}`}
            className="aspect-square border border-blue-200 bg-blue-100"
          ></div>
        );
      })}
      {/* Overlay for draggable items */}
      <div className="absolute inset-0">{children}</div>
    </div>
  );
});

interface DragDropModifier {
  configure?: (config: { size?: { x: number; y: number } }) => DragDropModifier;
  [key: string]: unknown;
}

// Draggable component
const Draggable: React.FC<{
  id: string;
  modifiers?: DragDropModifier[];
  style?: React.CSSProperties;
  colorClass: string;
}> = ({ id, modifiers = [], style = {}, colorClass = 'bg-blue-500 border-blue-600' }) => {
  const { ref, isDragging } = useDraggable({
    id,
    modifiers,
  });

  return (
    <div
      ref={ref}
      className={`absolute border-2 rounded cursor-grab flex items-center justify-center text-white font-bold text-sm ${
        colorClass
      } ${isDragging ? 'z-50 opacity-80 brightness-90' : 'z-10'}`}
      style={{
        ...style,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
    >
      {id}
    </div>
  );
};

type DragEndEvent = Parameters<DragDropEvents['dragend']>[0];

export const SeaGrid: React.FC = () => {
  const [rowSize, _setRowSize] = useState(10);
  const [colSize, _setColSize] = useState(10);

  const { ships, setShips } = useShips();

  const gridRef = useRef<HTMLDivElement | null>(null);
  const [cellPixelSize, setCellPixelSize] = useState<{
    width: number;
    height: number;
    gapX: number;
    gapY: number;
  }>({ width: 0, height: 0, gapX: 0, gapY: 0 });

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

  return (
    <div className="p-5">
      <DragDropProvider
        onDragEnd={(event: DragEndEvent) => {
          const draggedId = event.operation?.source?.id;
          if (!draggedId) return;

          setShips((prevShips) => {
            const draggedShip = prevShips.find((ship) => ship.id === draggedId);
            if (!draggedShip) return prevShips;

            const pixelPerCellX = cellPixelSize.width + cellPixelSize.gapX;
            const pixelPerCellY = cellPixelSize.height + cellPixelSize.gapY;

            const proposedX = Math.round(
              draggedShip.x + event.operation.transform.x / (pixelPerCellX || 1)
            );
            const proposedY = Math.round(
              draggedShip.y + event.operation.transform.y / (pixelPerCellY || 1)
            );

            // dnd already handle snap to grid, we do simple coordinate based collision dtection

            const proposedShip = {
              ...draggedShip,
              x: proposedX,
              y: proposedY,
            };

            // // Check for collision at the proposed position
            if (isColliding(proposedShip, prevShips)) {
              // If collision detected, keep the ship at its original position
              return prevShips;
            }

            // No collision, update the position
            return prevShips.map((ship) => (ship.id === draggedId ? proposedShip : ship));
          });
        }}
      >
        <div className="relative">
          <Grid ref={gridRef} rowSize={rowSize} colSize={colSize}>
            {ships.map((ship) => (
              <Draggable
                key={ship.id}
                id={ship.id}
                colorClass={ship.colorClass}
                modifiers={[
                  SnapModifier.configure({
                    size: {
                      x: cellPixelSize.width + cellPixelSize.gapX || 1,
                      y: cellPixelSize.height + cellPixelSize.gapY || 1,
                    },
                  }),
                  RestrictToElement.configure({
                    element: gridRef.current,
                  }),
                ]}
                style={{
                  left: `${ship.x * (cellPixelSize.width + cellPixelSize.gapX)}px`,
                  top: `${ship.y * (cellPixelSize.height + cellPixelSize.gapY)}px`,
                  width: `${
                    ship.orientation === 0
                      ? ship.length * cellPixelSize.width + (ship.length - 1) * cellPixelSize.gapX
                      : cellPixelSize.width
                  }px`,
                  height: `${
                    ship.orientation === 90
                      ? ship.length * cellPixelSize.height + (ship.length - 1) * cellPixelSize.gapY
                      : cellPixelSize.height
                  }px`,
                }}
              />
            ))}
          </Grid>
        </div>
      </DragDropProvider>
    </div>
  );
};
