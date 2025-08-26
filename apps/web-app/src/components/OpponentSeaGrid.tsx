import { stringifyCoordinates } from '@battleship/domain';
import {
  allMissiles$,
  currentGame$,
  missileResults$,
  opponentShips$,
} from '@battleship/schema/queries';
import { events, tables } from '@battleship/schema';
import { useClientDocument, useQuery, useStore } from '@livestore/react';
import { useCallback, useEffect, useMemo } from 'react';
import { useGridInteraction } from '@/hooks/useGridInteraction';
import type { CellPixelSize } from '@/util/coordinates';
import { useGameState } from './GameStateProvider';
import { HoverCell } from './HoverCell';
import { SeaGrid } from './SeaGrid';

export const OpponentSeaGrid = ({ player }: { player: string }) => {
  const { store } = useStore();
  const { hoverCell, createMouseMoveHandler, handleMouseLeave, createClickHandler } =
    useGridInteraction();

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

  return (
    <>
      <SeaGrid player={player} missileResults={missileResults ?? []} ships={opponentShips ?? []}>
        {({ cellPixelSize, gridRef }) => {
          const handleMouseMove = createMouseMoveHandler(gridRef, cellPixelSize);

          const handleClick = createClickHandler(gridRef, cellPixelSize, (cell) => {
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
          });

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
              <HoverCell cell={hoverCell} cellPixelSize={cellPixelSize} />
            </>
          );
        }}
      </SeaGrid>
      <div className="mt-2" />
    </>
  );
};

export default OpponentSeaGrid;
