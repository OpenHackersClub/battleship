import { stringifyCoordinates } from '@battleship/domain';
import { events, tables } from '@battleship/schema';
import { missileResults$, opponentShips$ } from '@battleship/schema/queries';
import { useClientDocument, useStore } from '@livestore/react';
import { useCallback, useEffect, useMemo } from 'react';
import { useGameState } from './GameStateProvider';
import { SeaGrid } from './SeaGrid';

export const OpponentSeaGrid = ({ player }: { player: string }) => {
  const { store } = useStore();

  const { currentGameId } = useGameState();

  const [{ myPlayer, opponent }] = useClientDocument(tables.uiState);

  const missileResults = store.useQuery(missileResults$(currentGameId ?? '', myPlayer));

  const opponentShipsQuery$ = useMemo(
    () => opponentShips$(currentGameId ?? '', opponent),
    [currentGameId, opponent]
  );

  const opponentShips = store.useQuery(opponentShipsQuery$);

  // useEffect(() => {
  //   // debug
  //   console.table(opponentShips);
  // }, [opponentShips]);

  const handleCellClick = useCallback(
    (x: number, y: number) => {
      console.log('fire attempt', `by ${myPlayer}`, stringifyCoordinates(x, y));
      const alreadyFired = missileResults?.find((m) => m.x === x && m.y === y);
      if (!alreadyFired) {
        const missileId = `missile-${Date.now()}-${Math.random()}`;
        store.commit(
          events.MissileFired({
            id: missileId,
            gameId: currentGameId,
            player: myPlayer,
            x,
            y,
            createdAt: new Date(),
          })
        );
      }
    },
    [store, currentGameId, myPlayer, missileResults]
  );

  return (
    <>
      <SeaGrid
        player={player}
        missileResults={missileResults ?? []}
        ships={opponentShips ?? []}
        onCellClick={handleCellClick}
      />
      <div className="mt-2" />
    </>
  );
};

export default OpponentSeaGrid;
