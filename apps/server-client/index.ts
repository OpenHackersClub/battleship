import { makeAdapter } from '@livestore/adapter-node';
import { createStorePromise, queryDb } from '@livestore/livestore';
import { makeCfSync } from '@livestore/sync-cf';
import { isColliding } from '@battleship/domain';

import process from 'node:process';
import { events, schema, tables } from '@battleship/schema';

import {
  currentGame$,
  missiles$,
  missileResults$,
  opponentShips$,
  lastAction$,
  lastMissile$,
  missileResultsById$,
} from '@battleship/schema/queries';

const LIVESTORE_SYNC_URL = 'ws://localhost:8787';

export const allGames$ = () =>
  queryDb(tables.games.orderBy('createdAt', 'desc'), {
    deps: [],
    label: `game@all`,
  });

const main = async () => {
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

  console.log('Server Store Id:', store.storeId);
  console.log('Current game:', currentGame);

  // TODO unsubscribe listener when game change

  // Set up missile subscription outside the Effect loop to prevent recreation
  if (currentGame) {
    const currentGameId = currentGame.id;
    const players = currentGame.players;
    const myPlayer = players[0]; // Assuming first player is the current player
    const opponentPlayer = players[1];

    console.log(
      'start listening to missiles',
      currentGameId,
      myPlayer,
      'opponent:',
      opponentPlayer
    );

    // Listen to MissileFired events for all players - moved outside Effect loop
    store.subscribe(missiles$(currentGameId, myPlayer), {
      skipInitialRun: false,
      // Issue: when specified true, onUpdate effect not being trigger even aftewards

      onSubscribe: (query$) => {
        console.log('subscribed');
      },
      onUpdate: (missiles) => {
        console.log('🚀 Missiles fired:', missiles.length, 'myPlayer', myPlayer, currentGame);

        if (missiles.length <= 0) {
          return;
        }

        const lastMissile = missiles?.[0];

        console.log('missile', lastMissile.id, missiles?.[0]?.x, missiles?.[0]?.y);

        // Get opponent ships to check for collision
        const opponentShips = opponentPlayer
          ? store.query(opponentShips$(currentGameId, opponentPlayer))
          : [];
        console.log('Opponent ships:', opponentShips?.length || 0, opponentShips);

        // Create missile as SeaObject for collision detection
        const missileSeaObject = {
          id: lastMissile.id,
          x: lastMissile.x,
          y: lastMissile.y,
          length: 1, // missiles always have length 1
          orientation: 0 as const, // missiles always have orientation 0
          player: lastMissile.player,
        };

        // Check for collision using the isColliding function
        const hitPosition = isColliding(missileSeaObject, opponentShips || []);
        const isHit = hitPosition !== undefined;

        console.log('Collision check:', isHit ? 'HIT!' : 'MISS', 'at position', hitPosition);

        const lastAction = store.query(lastAction$(currentGameId));

        // store.query(lastMissile$(currentGameId, myPlayer));

        const missileResult = store.query(missileResultsById$(currentGameId, lastMissile.id));

        console.log('missile result', missileResult);

        if (missileResult?.length > 0) {
          return;
        }
        console.log('last action', lastAction);

        const newTurn = (lastAction?.turn ?? 0) + 1;
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

        const missileResultEvent = isHit
          ? events.MissileHit({
              id: lastMissile.id,
              gameId: currentGameId,
              x: lastMissile.x,
              y: lastMissile.y,
              player: myPlayer,
              createdAt: new Date(),
            })
          : events.MissileMiss({
              id: lastMissile.id,
              gameId: currentGameId,
              x: lastMissile.x,
              y: lastMissile.y,
              player: myPlayer,
              createdAt: new Date(),
            });

        // workaround issue: commiting at next tick (0.3.1): error TypeError: Cannot read properties of undefined (reading 'refreshedAtoms')
        setTimeout(() => {
          // Fire either MissileHit or MissileMiss event based on collision result
          store.commit(
            events.ActionCompleted({
              id: crypto.randomUUID(),
              gameId: currentGameId,
              player: myPlayer,
              turn: newTurn,
              nextPlayer: isHit ? myPlayer : opponentPlayer,
            }),
            missileResultEvent
          );
        }, 1);
      },
    });
  }
};

main().catch(console.error);
