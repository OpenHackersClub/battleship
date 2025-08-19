import { Events, makeSchema, Schema, SessionIdSymbol, State } from '@livestore/livestore';

// TODO encryption
// We need to decrypt our own ships (to show on UI) but not the others

// You can model your state as SQLite tables (https://docs.livestore.dev/reference/state/sqlite-schema)
export const tables = {
  // myShips: State.SQLite.table({
  //   name: "myships",
  //   columns: {
  //     id: State.SQLite.text({ primaryKey: true }),
  //     player: State.SQLite.integer(),
  //     x: State.SQLite.integer(),
  //     y: State.SQLite.integer(),
  //     udpatedAt: State.SQLite.integer({
  //       nullable: true,
  //       schema: Schema.DateFromNumber,
  //     }),
  //   },
  // }),
  allShips: State.SQLite.table({
    name: 'allships',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      player: State.SQLite.integer(),
      x: State.SQLite.integer(),
      y: State.SQLite.integer(),
      udpatedAt: State.SQLite.integer({
        nullable: true,
        schema: Schema.DateFromNumber,
      }),
    },
  }),

  missles: State.SQLite.table({
    name: 'missles',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      player: State.SQLite.integer(),
      x: State.SQLite.integer(),
      y: State.SQLite.integer(),
      udpatedAt: State.SQLite.integer({
        nullable: true,
        schema: Schema.DateFromNumber,
      }),
    },
  }),
  gameBoard: State.SQLite.clientDocument({
    name: 'gameBoard',
    schema: Schema.Struct({
      gamePhase: Schema.Literal('setup', 'playing', 'finished'),
      currentPlayer: Schema.Number,
    }),
    default: { id: SessionIdSymbol, value: { gamePhase: 'setup', currentPlayer: 1 } },
  }),
  // Client documents can be used for local-only state (e.g. form inputs)
  uiState: State.SQLite.clientDocument({
    name: 'uiState',
    schema: Schema.Struct({
      gridSize: Schema.Number,
    }),
    default: { id: SessionIdSymbol, value: { gridSize: 50 } },
  }),
};

// For the grid, we use a cartesian plot and follow css coordinates convention
// for x right is positive, for y down is positive
// i.e. origin 0,0 is the top-left cell

// We model ships horizontal by default on (x-l, 0) where l is the length on the x-axis and head is at x
// thus orientaiton refers to clockwise angle from x-axis
// For now we support only 0 or 90 (vertical positioned at (0, x))
// the orientation is useful at ui, at storage it is implicitly deduced

// Events describe data changes (https://docs.livestore.dev/reference/events)
export const events = {
  ShipPositionUpdated: Events.synced({
    name: 'v1.ShipPositionUpdated',
    schema: Schema.Struct({
      id: Schema.String,
      actor: Schema.String,
      headX: Schema.Number,
      headY: Schema.Number,
      length: Schema.Number,
    }),
  }),

  MissleFired: Events.synced({
    name: 'v1.MissleFired',
    schema: Schema.Struct({
      id: Schema.String,
      actor: Schema.String,
      x: Schema.Number,
      y: Schema.Number,
    }),
  }),

  MissleHit: Events.synced({
    name: 'v1.MissleHit',
    schema: Schema.Struct({
      id: Schema.String,
      actor: Schema.String,
      x: Schema.Number,
      y: Schema.Number,
    }),
  }),

  MissleMiss: Events.synced({
    name: 'v1.MissleMiss',
    schema: Schema.Struct({
      id: Schema.String,
      x: Schema.Number,
      y: Schema.Number,
    }),
  }),

  uiStateSet: tables.uiState.set,
};

// Materializers are used to map events to state (https://docs.livestore.dev/reference/state/materializers)
const materializers = State.SQLite.materializers(events, {
  'v1.ShipPositionUpdated': ({ id, actor, headX, headY }) =>
    tables.allShips.insert({
      id,
      player: actor === 'player1' ? 1 : 2,
      x: headX,
      y: headY,
      udpatedAt: new Date(),
    }),
  'v1.MissleFired': ({ id, actor, x, y }) =>
    tables.missles.insert({ id, player: actor === 'player1' ? 1 : 2, x, y, udpatedAt: new Date() }),
  'v1.MissleHit': ({ id }) => tables.missles.update({ udpatedAt: new Date() }).where({ id }),
  'v1.MissleMiss': ({ id }) => tables.missles.update({ udpatedAt: new Date() }).where({ id }),
});

const state = State.SQLite.makeState({ tables, materializers });

export const schema = makeSchema({ events, state });
