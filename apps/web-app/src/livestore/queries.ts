import { queryDb } from '@livestore/livestore';

import { tables } from './schema.js';

export const uiState$ = queryDb(tables.uiState.get(), { label: 'uiState' });

// Query missiles at a specific grid coordinate (x, y)
export const missleAt$ = (x: number, y: number) =>
  queryDb(tables.missles.where('x', x).where('y', y), {
    deps: [x, y],
    label: `missles@${x},${y}`,
  });
