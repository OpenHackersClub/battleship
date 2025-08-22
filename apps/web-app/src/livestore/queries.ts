import { queryDb } from '@livestore/livestore';

import { tables } from './schema';

// export const uiState$ = queryDb(tables.uiState.get(), { label: 'uiState' });

// Query missiles at a specific grid coordinate (x, y)
export const missleAt$ = (gameId: string, x: number, y: number) =>
  queryDb(tables.missles.where('gameId', gameId).where('x', x).where('y', y), {
    deps: [x, y, gameId],
    label: `missles@${gameId}-${x},${y}`,
  });

export const allMissiles$ = (gameId: string) =>
  queryDb(tables.missles.where('gameId', gameId), {
    deps: [gameId],
    label: `missles@${gameId}`,
  });

export const allGames$ = () =>
  queryDb(tables.games.orderBy('createdAt', 'desc'), {
    deps: [],
    label: `game@all`,
  });

export const currentGame$ = () =>
  queryDb(
    tables.games.orderBy('createdAt', 'desc').first({
      fallback: () => null,
    }),
    {
      deps: [],
      label: `game@current`,
    }
  );

export const game$ = (gameId: string) =>
  queryDb(tables.games.where('id', gameId), {
    deps: [gameId],
    label: `game@${gameId}`,
  });

export const opponentShips$ = (gameId: string, opponentPlayer: string) =>
  queryDb(
    tables.allShips.where('gameId', gameId).where('player', opponentPlayer).orderBy('id', 'desc'),
    {
      deps: [gameId, opponentPlayer],
      label: `opponentShips@${gameId}-${opponentPlayer}`,
    }
  );
