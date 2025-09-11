import { stringifyCoordinates } from '@battleship/domain';
import { currentGame$, missileResults$, opponentShips$ } from '@battleship/schema/queries';
import { useClientDocument, useQuery, useStore } from '@livestore/react';
import { useCallback, useMemo } from 'react';
import { events, GamePhase, tables } from '../schema/schema';
import { useGameState } from './GameStateProvider';
import { SeaGrid } from './SeaGrid';

export const OpponentSeaGrid = ({ player }: { player: string }) => {
  const { store } = useStore();

  const { currentGameId } = useGameState();

  const [{ myPlayer, opponent }] = useClientDocument(tables.uiState);

  // Get current game to check phase
  const currentGame = useQuery(currentGame$());

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

  const isMyTurn = currentGame?.currentPlayer === myPlayer;
  const clickDisabled = currentGame?.gamePhase !== GamePhase.Playing || !isMyTurn;

  return (
    <>
      <div className="relative">
        <SeaGrid
          player={player}
          missileResults={missileResults ?? []}
          ships={opponentShips ?? []}
          clickDisabled={clickDisabled}
          onCellClick={handleCellClick}
        />
        {!isMyTurn && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="px-3 py-1 rounded bg-black/60 text-white text-sm select-none">
              waiting opponent
            </div>
          </div>
        )}
      </div>
      <div className="mt-2" />
    </>
  );
};

export default OpponentSeaGrid;
