import { missileResults$, opponentShips$ } from '@battleship/schema/queries';
import { events, tables } from '../schema/schema';
import { useClientDocument, useQuery, useStore } from '@livestore/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { stringifyCoordinates } from '@/util/coordinates';
import { useGameState } from './GameStateProvider';
import { MissileDisplay } from './MissileDisplay';
import { type CellPixelSize, SeaGrid } from './SeaGrid';

type Cell = { x: number; y: number };

export const OpponentSeaGrid = ({ player }: { player: string }) => {
  const [hoverCell, setHoverCell] = useState<Cell | null>(null);
  const { store } = useStore();

  const { currentGameId } = useGameState();

  const [{ myPlayer, opponent }] = useClientDocument(tables.uiState);

  const missileResults = store.useQuery(missileResults$(currentGameId ?? '', myPlayer));

  const opponentShipsQuery$ = useMemo(
    () => opponentShips$(currentGameId ?? '', opponent),
    [currentGameId, opponent]
  );

  const opponentShips = store.useQuery(opponentShipsQuery$);

  useEffect(() => {
    // debug
    console.table(opponentShips);
  }, [opponentShips]);

  const computeCellFromEvent = useCallback(
    (
      e: React.MouseEvent<Element>,
      gridElement: HTMLDivElement | null,
      cellPixelSize: CellPixelSize,
      cols = 10,
      rows = 10
    ): Cell | null => {
      if (!gridElement) return null;
      const rect = gridElement.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      const stepX = cellPixelSize.width + cellPixelSize.gapX;
      const stepY = cellPixelSize.height + cellPixelSize.gapY;
      if (stepX <= 0 || stepY <= 0) return null;
      const x = Math.max(0, Math.min(cols - 1, Math.floor(offsetX / stepX)));
      const y = Math.max(0, Math.min(rows - 1, Math.floor(offsetY / stepY)));
      return { x, y };
    },
    []
  );

  return (
    <>
      <SeaGrid player={player}>
        {({ cellPixelSize, gridRef }) => {
          const handleMouseMove = (e: React.MouseEvent) => {
            const cell = computeCellFromEvent(e, gridRef.current, cellPixelSize);
            setHoverCell(cell);
          };

          const handleMouseLeave = () => setHoverCell(null);

          const handleClick = (e: React.MouseEvent) => {
            const cell = computeCellFromEvent(e, gridRef.current, cellPixelSize);
            if (cell) {
              console.log('fire attempt', `by ${myPlayer}`, stringifyCoordinates(cell.x, cell.y));
              const alreadyFired = missileResults.find((m) => m.x === cell.x && m.y === cell.y);
              if (!alreadyFired) {
                const missileId = `missile-${Date.now()}-${Math.random()}`;
                store.commit(
                  events.MissileFired({
                    id: missileId,
                    gameId: currentGameId,
                    player: myPlayer,
                    x: cell.x,
                    y: cell.y,
                    createdAt: new Date(),
                  })
                );
              }
            }
          };

          const left = hoverCell ? hoverCell.x * (cellPixelSize.width + cellPixelSize.gapX) : 0;
          const top = hoverCell ? hoverCell.y * (cellPixelSize.height + cellPixelSize.gapY) : 0;
          const width = cellPixelSize.width;
          const height = cellPixelSize.height;

          return (
            <>
              <button
                type="button"
                className="absolute inset-0 z-20"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    // simulate click via keyboard
                    handleClick(e as unknown as React.MouseEvent);
                  }
                }}
                aria-label="opponent grid overlay"
              />
              <MissileDisplay
                missileResults={missileResults ?? []}
                ships={opponentShips ?? []}
                cellPixelSize={cellPixelSize}
              />
              {hoverCell && (
                <div
                  className="absolute z-10 bg-blue-400/40 border border-blue-500 pointer-events-none"
                  style={{ left, top, width, height }}
                />
              )}
            </>
          );
        }}
      </SeaGrid>
      <div className="mt-2" />
    </>
  );
};

export default OpponentSeaGrid;
