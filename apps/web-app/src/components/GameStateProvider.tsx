import { queryDb } from '@livestore/livestore';
import { useStore } from '@livestore/react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createInitialShips } from '@/lib/domain/GameState';
import { events, tables } from '@/livestore/schema';
import type { Ship } from '../lib/domain/SeaObject';

// TODO
type GameStateContextValue = {};

const GameStateContext = createContext<GameStateContextValue | undefined>(undefined);

export function useShips(): GameStateContextValue {
  const ctx = useContext(GameStateContext);
  if (!ctx) throw new Error('useShips must be used within a ShipsProvider');
  return ctx;
}

export function GameStateProvider({ children }: { children: React.ReactNode }) {
  const player = 'player1';
  const { store } = useStore();

  const playerShips = store.useQuery(
    queryDb(tables.allShips.where('player', player).orderBy('id', 'desc'), {
      deps: [player],
    })
  );

  useEffect(() => {
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
          player,
          x: ship.x,
          y: ship.y,
          orientation: 0,
          length: ship.length,
        })
      )
    );
  }, [store.commit, playerShips]);

  useEffect(() => {
    store.commit(events.uiStateSet({ myShips: playerShips }));
  }, [playerShips, store.commit]);

  const value = useMemo(() => ({}), []);
  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>;
}
