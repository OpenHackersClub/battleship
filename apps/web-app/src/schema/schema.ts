/**
 * Now we clone the file as in schema package
 * to avoid issue of Symbol not being serializable at Client Document
 */
import { Events, makeSchema, Schema, SessionIdSymbol, State } from '@livestore/livestore';

// Game phase enum
export enum GamePhase {
  Setup = 'setup',
  Playing = 'playing',
  Finished = 'finished',
}
// TODO encryption
// We need to decrypt our own ships (to show on UI) but not the others

// You can model your state as SQLite tables (https://docs.livestore.dev/reference/state/sqlite-schema)

/**
 * Game: Each game session with a grid size, players, and 1 winner at the end
 *
 * Turn: Consist of single action by single player, it's anoother turn when player taking next action conseuctively or another player take action 
 * Turn count ranges from [0, to 2 * grid Size ]
 *
 * Action: User can fire missle to a single cell of cooridnates (x,y) of single oppoonent

 */

export const tables = {
  // game id is supposedly the foreign key, not encoreced as not yet supported at livestore https://github.com/livestorejs/livestore/discussions/400

  // offers a simple way to query
  // - current (controlling) player of the turn
  // - current turn count

  games: State.SQLite.table({
    name: 'games',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      gamePhase: State.SQLite.text({
        schema: Schema.Literal('setup', 'playing', 'finished'),
      }),
      players: State.SQLite.text({
        nullable: false,
        schema: Schema.parseJson(Schema.Array(Schema.String)),
      }),
      currentTurn: State.SQLite.integer(),
      currentPlayer: State.SQLite.text(),

      createdAt: State.SQLite.integer({
        nullable: false,
        schema: Schema.DateFromNumber,
      }),
    },
  }),

  actions: State.SQLite.table({
    name: 'actions',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      gameId: State.SQLite.text({ primaryKey: true }),
      player: State.SQLite.text({ primaryKey: true }),
      turn: State.SQLite.integer(),
    },
  }),
  allShips: State.SQLite.table({
    name: 'allships',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      gameId: State.SQLite.text({ primaryKey: true, nullable: true }),
      player: State.SQLite.text(),
      x: State.SQLite.integer(),
      y: State.SQLite.integer(),
      orientation: State.SQLite.integer({ schema: Schema.Literal(0, 90) }),
      length: State.SQLite.integer(),
      updatedAt: State.SQLite.integer({
        nullable: true,
        schema: Schema.DateFromNumber,
      }),
    },
  }),

  /**
   * For missle fire attempt
   * use a separate table for confirmed missle hit/miss (missle could be illegal action if out of turn)
   * so we can subscibre update (insert) to this missiles & avoid infinite trigger
   */
  missiles: State.SQLite.table({
    name: 'missiles',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      gameId: State.SQLite.text({ primaryKey: true, nullable: false }),
      player: State.SQLite.text(),
      x: State.SQLite.integer(),
      y: State.SQLite.integer(),
      createdAt: State.SQLite.integer({
        nullable: false,
        schema: Schema.DateFromNumber,
      }),
    },
  }),

  missileResults: State.SQLite.table({
    name: 'missle-results',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      gameId: State.SQLite.text({ primaryKey: true, nullable: false }),
      player: State.SQLite.text(),
      x: State.SQLite.integer(),
      y: State.SQLite.integer(),
      isHit: State.SQLite.boolean(),
      createdAt: State.SQLite.integer({
        nullable: false,
        schema: Schema.DateFromNumber,
      }),
    },
  }),

  // Client documents can be used for local-only state (e.g. form inputs)
  uiState: State.SQLite.clientDocument({
    name: 'uiState',
    schema: Schema.Struct({
      currentGameId: Schema.String,
      myPlayer: Schema.String,
      // TODO consider multiplayer
      opponent: Schema.String,
      winner: Schema.NullOr(Schema.String),
      myShips: Schema.Array(
        Schema.Struct({
          id: Schema.String,
          player: Schema.String,
          x: Schema.Number,
          y: Schema.Number,
          orientation: Schema.Literal(0, 90),
          length: Schema.Number,
        })
      ),
    }),
    default: {
      id: SessionIdSymbol,
      value: {
        currentGameId: '',
        myPlayer: '',
        opponent: '',
        winner: null,
        myShips: [],
      },
    },
  }),
} as const;

// For the grid, we use a cartesian plot and follow css coordinates convention
// for x right is positive, for y down is positive
// i.e. origin 0,0 is the top-left cell

// We model ships horizontal by default on (x-l, 0) where l is the length on the x-axis and head is at x
// thus orientaiton refers to clockwise angle from x-axis
// For now we support only 0 or 90 (vertical positioned at (0, x))
// the orientation is useful at ui, at storage it is implicitly deduced

// Events describe data changes (https://docs.livestore.dev/reference/events)
export const events = {
  GameStarted: Events.synced({
    name: 'v1.GameStarted',
    schema: Schema.Struct({
      id: Schema.String,
      gamePhase: Schema.optional(Schema.Literal('setup', 'playing', 'finished')),
      players: Schema.optional(Schema.Array(Schema.String)),
      createdAt: Schema.optional(Schema.DateFromNumber),
    }),
  }),
  GameUpdated: Events.synced({
    name: 'v1.GameUpdated',
    schema: Schema.Struct({
      id: Schema.String,
      gamePhase: Schema.optional(Schema.Literal('setup', 'playing', 'finished')),
      players: Schema.optional(Schema.Array(Schema.String)),
      createdAt: Schema.optional(Schema.DateFromNumber),
    }),
  }),
  ShipPositionCreated: Events.synced({
    name: 'v1.ShipPositionCreated',
    schema: Schema.Struct({
      id: Schema.String,
      gameId: Schema.optional(Schema.String),
      player: Schema.String,
      x: Schema.Number,
      y: Schema.Number,
      orientation: Schema.Literal(0, 90),
      length: Schema.Number,
    }),
  }),

  ActionCompleted: Events.synced({
    name: 'v1.ActionCompleted',
    schema: Schema.Struct({
      id: Schema.String,
      gameId: Schema.String,
      player: Schema.String,
      nextPlayer: Schema.String,
      turn: Schema.Number,
    }),
  }),

  MissileFired: Events.synced({
    name: 'v1.MissileFired',
    schema: Schema.Struct({
      id: Schema.String,
      gameId: Schema.String,
      player: Schema.String,
      x: Schema.Number,
      y: Schema.Number,
      createdAt: Schema.DateFromNumber,
    }),
  }),

  MissileHit: Events.synced({
    name: 'v1.MissileHit',
    schema: Schema.Struct({
      id: Schema.String,
      gameId: Schema.String,
      player: Schema.String,
      x: Schema.Number,
      y: Schema.Number,
      createdAt: Schema.DateFromNumber,
    }),
  }),

  MissileMiss: Events.synced({
    name: 'v1.MissileMiss',
    schema: Schema.Struct({
      id: Schema.String,
      gameId: Schema.String,
      player: Schema.String,
      x: Schema.Number,
      y: Schema.Number,
      createdAt: Schema.DateFromNumber,
    }),
  }),

  uiStateSet: tables.uiState.set,
};

// Materializers are used to map events to state (https://docs.livestore.dev/reference/state/materializers)
const materializers = State.SQLite.materializers(events, {
  'v1.GameStarted': ({ id, gamePhase, players, createdAt }) =>
    tables.games.insert({
      id,
      gamePhase: (gamePhase ?? 'setup') as 'setup' | 'playing' | 'finished',
      currentTurn: 0,
      currentPlayer: players?.[0] ?? '',
      players: players ?? [],
      createdAt: createdAt ?? new Date(),
    }),
  'v1.GameUpdated': ({ id, gamePhase }) =>
    tables.games.where({ id }).update({
      gamePhase: (gamePhase ?? 'setup') as 'setup' | 'playing' | 'finished',
    }),
  'v1.ShipPositionCreated': ({ id, gameId, player, x, y, orientation, length }) =>
    tables.allShips.insert({
      id,
      gameId,
      player,
      x,
      y,
      orientation,
      length,
    }),

  'v1.ActionCompleted': ({ id, gameId, player, nextPlayer, turn }) => {
    console.log('iterate turn', gameId, turn + 1, nextPlayer);
    return [
      tables.actions.insert({
        id,
        gameId,
        player,
        turn,
      }),
      tables.games.where({ id: gameId }).update({
        currentTurn: turn + 1,
        currentPlayer: nextPlayer,
      }),
    ];
  },

  'v1.MissileFired': ({ id, gameId, player, x, y, createdAt }) =>
    tables.missiles.insert({
      id,
      gameId,
      player,
      x,
      y,
      createdAt,
    }),
  'v1.MissileHit': ({ id, gameId, player, x, y, createdAt }) =>
    tables.missileResults.insert({
      id,
      gameId,
      player,
      x,
      y,
      isHit: true,
      createdAt,
    }),
  'v1.MissileMiss': ({ id, gameId, player, x, y, createdAt }) =>
    tables.missileResults.insert({
      id,
      gameId,
      player,
      x,
      y,
      isHit: false,
      createdAt,
    }),
});

const state = State.SQLite.makeState({ tables, materializers });

export const schema = makeSchema({ events, state });

// Export types for external use
export type Tables = typeof tables;
export type BattleshipEvents = typeof events;
export type BattleshipSchema = typeof schema;
