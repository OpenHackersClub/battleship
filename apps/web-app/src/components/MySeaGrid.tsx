import { isColliding } from '@battleship/domain';
import { missileResults$ } from '@battleship/schema/queries';
import { SnapModifier } from '@dnd-kit/abstract/modifiers';
import { RestrictToElement } from '@dnd-kit/dom/modifiers';
import { type DragDropEvents, useDraggable } from '@dnd-kit/react';
import { useClientDocument, useStore } from '@livestore/react';
import type React from 'react';
import { useCallback, useRef } from 'react';
import {
  type CellPixelSize,
  calculateCellPosition,
  calculateShipDimensions,
  getCellStep,
} from '@/util/coordinates';
import { tables } from '../schema/schema';
import { useGameState } from './GameStateProvider';
import { SeaGrid, SHIP_COLOR_CLASSES } from './SeaGrid';

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
  const { stepX, stepY } = getCellStep(cellPixelSize);
  const { ref, isDragging } = useDraggable({
    id,
    modifiers: [
      SnapModifier.configure({
        size: {
          x: stepX || 1,
          y: stepY || 1,
        },
      }),
      RestrictToElement.configure({ element: gridElement }),
    ],
  });

  const { left, top } = calculateCellPosition(x, y, cellPixelSize);
  const { width, height } = calculateShipDimensions(length, orientation, cellPixelSize);

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
  const [{ myShips, opponent }, setState] = useClientDocument(tables.uiState);
  const { store } = useStore();
  const { currentGameId } = useGameState();

  const latestCellPixelSize = useRef<CellPixelSize>({ width: 0, height: 0, gapX: 0, gapY: 0 });

  const opponentMissileResults = store.useQuery(
    missileResults$(currentGameId || '', opponent || '')
  );
  const filteredOpponentMissileResults = !currentGameId || !opponent ? [] : opponentMissileResults;

  const onDragEnd = useCallback<DragDropEvents['dragend']>(
    (event) => {
      const draggedId = event.operation?.source?.id;
      if (!draggedId) return;

      const draggedShip = myShips.find((ship) => ship.id === draggedId);
      if (!draggedShip) return;

      const cellPixelSize = latestCellPixelSize.current;
      const { stepX: pixelPerCellX, stepY: pixelPerCellY } = getCellStep(cellPixelSize);

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
    <SeaGrid
      player={player}
      onDragEnd={onDragEnd}
      missileResults={filteredOpponentMissileResults}
      ships={myShips}
    >
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
