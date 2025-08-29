import { Events, makeSchema, Schema, SessionIdSymbol, State } from '@livestore/livestore';

export const clientDocs = {
  // Client documents can be used for local-only state (e.g. form inputs)
  uiState: State.SQLite.clientDocument({
    name: 'uiState',
    schema: Schema.Struct({
      currentGameId: Schema.String,
      myPlayer: Schema.String,
      // TODO consider multiplayer
      opponent: Schema.String,
      winner: Schema.optional(Schema.String),
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
      value: { currentGameId: '', myPlayer: '', opponent: '', winner: undefined, myShips: [] },
    },
  }),
};
