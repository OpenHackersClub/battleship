import { stringifyCoordinates } from '@battleship/domain';
import { currentGame$, missileResults$, opponentShips$ } from '@battleship/schema/queries';
import { useClientDocument, useQuery, useStore } from '@livestore/react';
import { useCallback, useMemo } from 'react';
import { events, GamePhase, tables } from '../schema/schema';
import type { GameService } from '../util/gameService';
import { useGameState } from './GameStateProvider';
import { SeaGrid } from './SeaGrid';

interface OpponentSeaGridProps {
  player: string;
  gameService?: GameService;
}

export const OpponentSeaGrid = ({ player, gameService }: OpponentSeaGridProps) => {
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

        // In browser AI mode, process the user's missile locally to update the turn
        const aiType = currentGame?.aiPlayerType;
        if (aiType === 'browserai' && gameService && currentGameId) {
          gameService.processUserMissile({
            missileId,
            currentGameId,
            myPlayer,
            opponent,
            x,
            y,
          });
        }
      }
    },
    [
      store,
      currentGameId,
      myPlayer,
      opponent,
      missileResults,
      currentGame?.aiPlayerType,
      gameService,
    ]
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
