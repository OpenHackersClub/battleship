import * as process from 'process';

import { makeAdapter } from '@livestore/adapter-node';
import { createStorePromise, queryDb } from '@livestore/livestore';
import { makeCfSync } from '@livestore/sync-cf';
import { Effect, Schedule, Console } from 'effect';

import { events, schema, tables, stringifyCoordinates } from '@battleship/schema';

import {
  currentGame$,
  gameActions$,
  missiles$,
  lastMissile$,
  missileResults$,
  lastAction$,
} from '@battleship/schema/queries';

const LIVESTORE_SYNC_URL = 'ws://localhost:8787';

export const allGames$ = () =>
  queryDb(tables.games.orderBy('createdAt', 'desc'), {
    deps: [],
    label: `game@all`,
  });

const main = async () => {
  const state = {
    currentTurn: 0,
    missleCount: 0,
  };

  const adapter = makeAdapter({
    storage: { type: 'fs', baseDirectory: 'tmp' },
    sync: { backend: makeCfSync({ url: LIVESTORE_SYNC_URL }), onSyncError: 'ignore' },
  });

  const storeId = process.env.VITE_STORE_ID;
  if (!storeId) {
    throw new Error(
      'VITE_STORE_ID is not set in env variables. Configure same store id across all clients'
    );
  }

  // necessary to use same store id across
  console.log('setup store');
  const store = await createStorePromise({
    adapter,
    schema,
    storeId,
    syncPayload: { authToken: 'insecure-token-change-me' },
  });

  await new Promise((resolve) => setTimeout(resolve, 5 * 1000));
  // Get current game and setup event listeners
  const currentGame = store.query(currentGame$());
  const allGames = store.query(allGames$());
  console.log('Server Store Id:', store.storeId);
  console.log('Current game:', currentGame);

  // TODO unsubscribe listener when game change

  // Set up missile subscription outside the Effect loop to prevent recreation
  if (currentGame) {
    const currentGameId = currentGame.id;
    const players = currentGame.players;
    const myPlayer = players[0]; // Assuming first player is the current player

    console.log('start listening to missiles', currentGameId, myPlayer);

    // Check if there are any existing missiles to understand the data state
    const existingMissiles = store.query(missiles$(currentGameId, myPlayer));
    console.log('Existing missiles in store:', existingMissiles?.length || 0, existingMissiles);

    // Listen to MissileFired events for all players - moved outside Effect loop
    store.subscribe(missiles$(currentGameId, myPlayer), {
      skipInitialRun: false, // Changed to false to see initial data
      onUpdate: (missiles) => {
        console.log('🚀 Missiles fired:', missiles.length, 'myPlayer', myPlayer, currentGame);

        if (missiles.length <= 0) {
          return;
        }

        const lastMissile = missiles?.[0];

        console.log('missile', lastMissile.id, missiles?.[0]?.x, missiles?.[0]?.y);

        /**
         *
         * Only 1 action per player at each turn
         *   - MissileFired events will be reject if not player's turn / turn is not the current turn
         *
         * Here we don't associate MissileFired event with turn. Users could rapidly click around where validations happen at server afterwards
         * (extra turn is granted when player hit a ship)
         * Edge case when events are fired from multiple devices and arrived out of order
         *
         */

        // TODO check existing turn

        // workaround issue: commiting at next tick (0.3.1): error TypeError: Cannot read properties of undefined (reading 'refreshedAtoms')
        setTimeout(() => {
          store.commit(
            // events.ActionCompleted({
            //   id: crypto.randomUUID(),
            //   gameId: currentGameId,
            //   player: myPlayer,
            //   turn: state.currentTurn,
            // }),
            events.MissileHit({
              id: lastMissile.id,
              gameId: currentGameId,
              x: lastMissile.x,
              y: lastMissile.y,
              player: myPlayer,
              createdAt: new Date(),
            })
          );
        }, 1);
      },
    });

    const existing = store.query(missileResults$(currentGameId, myPlayer));
    console.log('existing missile results:', existing);
  }
};

main().catch(console.error);
