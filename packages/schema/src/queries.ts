import { queryDb } from '@livestore/livestore';

import { tables } from './schema';

// Query missiles at a specific grid coordinate (x, y)
export const missleAt$ = (gameId: string, x: number, y: number) =>
  queryDb(tables.missiles.where('gameId', gameId).where('x', x).where('y', y), {
    deps: [x, y, gameId],
    label: `missiles@${gameId}-${x},${y}`,
  });

export const allMissiles$ = (gameId: string) =>
  queryDb(tables.missiles.where('gameId', gameId), {
    deps: [gameId],
    label: `missiles@${gameId}`,
  });

export const allGames$ = () =>
  queryDb(tables.games.orderBy('createdAt', 'desc'), {
    deps: [],
    label: `game@all`,
  });

export const currentGame$ = () =>
  queryDb(
    tables.games.orderBy('createdAt', 'desc').first({
      behaviour: 'fallback',
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

export const missiles$ = (gameId: string, player: string) =>
  queryDb(
    tables.missiles.where('gameId', gameId).where('player', player).orderBy('createdAt', 'desc'),
    {
      deps: [gameId, player],
      label: `missiles-fired@${gameId}-${player}`,
    }
  );

export const missileResults$ = (gameId: string, player: string) =>
  queryDb(
    tables.missileResults
      .where('gameId', gameId)
      .where('player', player)
      .orderBy('createdAt', 'desc'),
    {
      deps: [gameId, player],
      label: `missile-results@${gameId}-${player}`,
    }
  );

export const missileResultsById$ = (gameId: string, id: string) =>
  queryDb(tables.missileResults.where('id', id), {
    deps: [id],
    label: `missile-results@${gameId}-${id}`,
  });

export const lastMissile$ = (gameId: string, player: string) =>
  queryDb(
    tables.missiles
      .where('gameId', gameId)
      .where('player', player)
      .orderBy('createdAt', 'desc')
      .first({
        behaviour: 'fallback',
        fallback: () => null,
      }),
    {
      deps: [gameId, player],
      label: `missiles-fired@${gameId}-${player}-last`,
    }
  );

// Query ships at a specific coordinate for hit detection
export const shipsAt$ = (gameId: string, x: number, y: number) =>
  queryDb(tables.allShips.where('gameId', gameId).where('x', x).where('y', y), {
    deps: [gameId, x, y],
    label: `ships@${gameId}-${x}-${y}`,
  });

// Query all actions for a game ordered by turn (most recent first)
export const gameActions$ = (gameId: string) =>
  queryDb(tables.actions.where('gameId', gameId).orderBy('turn', 'desc'), {
    deps: [gameId],
    label: `actions@${gameId}`,
  });

// Query all actions for a game (all turns)
export const allGameActions$ = (gameId: string) =>
  queryDb(tables.actions.where('gameId', gameId), {
    deps: [gameId],
    label: `all-actions@${gameId}`,
  });

export const lastAction$ = (gameId: string) =>
  queryDb(
    tables.actions
      .where('gameId', gameId)
      .orderBy('turn', 'desc')
      .first({ behaviour: 'fallback', fallback: () => null }),
    {
      deps: [gameId],
      label: `actions@${gameId}-last`,
    }
  );
