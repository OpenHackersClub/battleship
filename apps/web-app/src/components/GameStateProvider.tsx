import { queryDb } from '@livestore/livestore';
import { useStore } from '@livestore/react';
import { createContext, useContext, useEffect, useMemo } from 'react';
import { createInitialShips } from '@/lib/domain/GameState';
import { events, tables } from '@/livestore/schema';
import type { Ship } from '../lib/domain/SeaObject';

type GameStateContextValue = {
  currentGameId: string | undefined;
};

const GameStateContext = createContext<GameStateContextValue | undefined>(undefined);

export function useGameState(): GameStateContextValue {
  const ctx = useContext(GameStateContext);
  if (!ctx) throw new Error('useGameState must be used within a GameStateContextProvider');
  return ctx;
}

export function GameStateProvider({ children }: { children: React.ReactNode }) {
  const player = 'player1';
  const { store } = useStore();

  const games$ = queryDb(tables.games.orderBy('createdAt', 'desc'), { label: 'games-gsp' });
  const games = store.useQuery(games$);
  const currentGameId = games?.[0]?.id as string | undefined;

  const playerShips = store.useQuery(
    queryDb(
      tables.allShips
        .where('player', player)
        .where('gameId', currentGameId ?? null)
        .orderBy('id', 'desc'),
      { deps: [player, currentGameId] }
    )
  );

  useEffect(() => {
    if (!currentGameId) return;
    if (playerShips.length > 0) return;
    const initialships: Ship[] = createInitialShips({
      player: 'player1',
      colSize: 10,
      rowSize: 10,
    });

    store.commit(
      ...initialships.map((ship: Ship) =>
        events.ShipPositionCreated({
          id: ship.id,
          gameId: currentGameId,
          player,
          x: ship.x,
          y: ship.y,
          orientation: ship.orientation,
          length: ship.length,
        })
      )
    );
  }, [store.commit, playerShips, currentGameId]);

  useEffect(() => {
    store.commit(events.uiStateSet({ myShips: playerShips }));
  }, [playerShips, store.commit]);

  const value = useMemo(
    () => ({
      currentGameId,
    }),
    [currentGameId]
  );
  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>;
}
