import { isColliding } from '@battleship/domain';
import { tables } from '@battleship/schema';
import { SnapModifier } from '@dnd-kit/abstract/modifiers';
import { RestrictToElement } from '@dnd-kit/dom/modifiers';
import { type DragDropEvents, useDraggable } from '@dnd-kit/react';
import { useClientDocument } from '@livestore/react';
import type React from 'react';
import { useCallback, useRef } from 'react';
import { type CellPixelSize, SeaGrid, SHIP_COLOR_CLASSES } from './SeaGrid';

const DraggableShip: React.FC<{
  id: string;
  idx: number;
  x: number;
  y: number;
  length: number;
  orientation: 0 | 90;
  cellPixelSize: CellPixelSize;
  gridElement: HTMLDivElement | null;
}> = ({ id, idx, x, y, length, orientation, cellPixelSize, gridElement }) => {
  const { ref, isDragging } = useDraggable({
    id,
    modifiers: [
      SnapModifier.configure({
        size: {
          x: cellPixelSize.width + cellPixelSize.gapX || 1,
          y: cellPixelSize.height + cellPixelSize.gapY || 1,
        },
      }),
      RestrictToElement.configure({ element: gridElement }),
    ],
  });

  const left = x * (cellPixelSize.width + cellPixelSize.gapX);
  const top = y * (cellPixelSize.height + cellPixelSize.gapY);
  const width =
    orientation === 0
      ? length * cellPixelSize.width + (length - 1) * cellPixelSize.gapX
      : cellPixelSize.width;
  const height =
    orientation === 90
      ? length * cellPixelSize.height + (length - 1) * cellPixelSize.gapY
      : cellPixelSize.height;

  return (
    <div
      ref={ref}
      className={`absolute border-2 rounded cursor-grab flex items-center justify-center text-white font-bold text-sm ${
        SHIP_COLOR_CLASSES[idx % SHIP_COLOR_CLASSES.length]
      } ${isDragging ? 'z-50 opacity-80 brightness-90' : 'z-10'}`}
      style={{
        left,
        top,
        width,
        height,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
    ></div>
  );
};

export const MySeaGrid: React.FC<{ player: string }> = ({ player }) => {
  const [{ myShips }, setState] = useClientDocument(tables.uiState);

  const latestCellPixelSize = useRef<CellPixelSize>({ width: 0, height: 0, gapX: 0, gapY: 0 });

  const onDragEnd = useCallback<DragDropEvents['dragend']>(
    (event) => {
      const draggedId = event.operation?.source?.id;
      if (!draggedId) return;

      const draggedShip = myShips.find((ship) => ship.id === draggedId);
      if (!draggedShip) return;

      const cellPixelSize = latestCellPixelSize.current;
      const pixelPerCellX = cellPixelSize.width + cellPixelSize.gapX;
      const pixelPerCellY = cellPixelSize.height + cellPixelSize.gapY;

      const proposedX = Math.round(
        draggedShip.x + event.operation.transform.x / (pixelPerCellX || 1)
      );
      const proposedY = Math.round(
        draggedShip.y + event.operation.transform.y / (pixelPerCellY || 1)
      );

      const proposedShip = {
        ...draggedShip,
        x: proposedX,
        y: proposedY,
      };

      if (isColliding(proposedShip, [...myShips])) {
        return;
      }

      const newShips = myShips.map((ship) => (ship.id === draggedId ? proposedShip : ship));

      setState({ myShips: newShips });
    },
    [myShips, setState]
  );

  return (
    <SeaGrid player={player} onDragEnd={onDragEnd}>
      {({ cellPixelSize, gridRef }) => {
        latestCellPixelSize.current = cellPixelSize;
        return (
          <>
            {myShips.map((ship, idx) => (
              <DraggableShip
                key={ship.id}
                id={ship.id}
                idx={idx}
                x={ship.x}
                y={ship.y}
                length={ship.length}
                orientation={ship.orientation}
                cellPixelSize={cellPixelSize}
                gridElement={gridRef.current}
              />
            ))}
          </>
        );
      }}
    </SeaGrid>
  );
};
