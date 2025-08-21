import { queryDb } from '@livestore/livestore';

import { tables } from './schema.js';

export const uiState$ = queryDb(tables.uiState.get(), { label: 'uiState' });

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
