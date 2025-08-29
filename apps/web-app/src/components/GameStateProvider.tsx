import { createInitialShips, GAME_CONFIG, type Ship } from '@battleship/domain';
import { currentGame$ } from '@battleship/schema/queries';
import { events, tables } from '../schema/schema';
import { queryDb } from '@livestore/livestore';
import { useClientDocument, useQuery, useStore } from '@livestore/react';
import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';

// Re-export the shared game configuration
export { GAME_CONFIG };

type GameStateContextValue = {
  currentGameId: string | undefined;
  newGame: () => void;
};

const GameStateContext = createContext<GameStateContextValue | undefined>(undefined);

export function useGameState(): GameStateContextValue {
  const ctx = useContext(GameStateContext);
  if (!ctx) throw new Error('useGameState must be used within a GameStateContextProvider');
  return ctx;
}

export function GameStateProvider({ children }: { children: React.ReactNode }) {
  const { store } = useStore();

  const [{ currentGameId, myPlayer, opponent }, setState] = useClientDocument(tables.uiState);

  const currentGame = useQuery(currentGame$());

  useEffect(() => {
    console.log('currentGame', currentGame?.id, currentGame?.createdAt);

    if (currentGame) {
      setState({
        currentGameId: currentGame.id,
        myPlayer: currentGame.players[0],
        opponent: currentGame.players[1],
      });
    }
  }, [currentGame, setState]);

  // TODO extxend with matchmaking
  const newGame = useCallback(() => {
    const gameId = `game-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const players = Array.from({ length: 2 }, (_, i) => `player-${i + 1}`);

    const myPlayer = players[0];
    const opponent = players[1];

    console.log('Game Started', gameId, players);
    store.commit(
      events.GameStarted({
        id: gameId,
        gamePhase: 'setup',
        players,
        createdAt: new Date(),
      })
    );

    setState({
      currentGameId: gameId,
      myPlayer,
      opponent,
      myShips: [],
    });
  }, [store.commit, setState]);

  const playerShips = store.useQuery(
    queryDb(
      tables.allShips
        .where('player', myPlayer)
        .where('gameId', currentGameId ?? null)
        .orderBy('id', 'desc'),
      { deps: [myPlayer, currentGameId] }
    )
  );

  useEffect(() => {
    if (!currentGameId) return;
    console.log('new game:', currentGameId);
    if (playerShips.length > 0) return;
    const initialships: Ship[] = createInitialShips({
      player: myPlayer,
      colSize: GAME_CONFIG.colSize,
      rowSize: GAME_CONFIG.rowSize,
      shipCount: GAME_CONFIG.shipCount,
    });

    // TODO by agent / server
    const initialOpponentShips: Ship[] = createInitialShips({
      player: opponent,
      colSize: GAME_CONFIG.colSize,
      rowSize: GAME_CONFIG.rowSize,
      shipCount: GAME_CONFIG.shipCount,
    });

    store.commit(
      ...initialOpponentShips.map((ship: Ship) =>
        events.ShipPositionCreated({
          id: ship.id,
          gameId: currentGameId,
          player: opponent,
          x: ship.x,
          y: ship.y,
          orientation: ship.orientation,
          length: ship.length,
        })
      ),
      ...initialships.map((ship: Ship) =>
        events.ShipPositionCreated({
          id: ship.id,
          gameId: currentGameId,
          player: myPlayer,
          x: ship.x,
          y: ship.y,
          orientation: ship.orientation,
          length: ship.length,
        })
      )
    );
  }, [store.commit, playerShips, currentGameId, myPlayer, opponent]);

  useEffect(() => {
    store.commit(events.uiStateSet({ myShips: playerShips }));
  }, [playerShips, store.commit]);

  const value = useMemo(
    () => ({
      currentGameId,
      newGame,
    }),
    [currentGameId, newGame]
  );
  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>;
}
