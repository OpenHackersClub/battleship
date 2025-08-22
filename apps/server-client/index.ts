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
    sync: { backend: makeCfSync({ url: LIVESTORE_SYNC_URL }), onSyncError: 'shutdown' },
  });

  const storeId = process.env.VITE_STORE_ID;
  if (!storeId) {
    throw new Error(
      'VITE_STORE_ID is not set in env variables. Configure same store id across all clients'
    );
  }

  // necessary to use same store id across

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

  console.log('allGames', allGames);
  if (currentGame) {
    const currentGameId = currentGame.id;
    const players = currentGame.players;
    const myPlayer = players[0]; // Assuming first player is the current player

    console.log('start listening to missiles');
    // // Listen to MissileFired events for all players
    store.subscribe(missiles$(currentGameId, myPlayer), {
      skipInitialRun: false,

      onUpdate: (missiles) => {
        console.log('🚀 Missiles fired:', missiles.length);
        console.log('myPlayer', myPlayer, currentGame, missiles.length);

        state.missleCount = missiles.length;

        const lastMissile = missiles?.[0];

        console.log('missile', lastMissile.id, missiles?.[0]?.x, missiles?.[0]?.y);

        /**
         *
         * Only 1 action per player at each turn
         *   - MissleFired events will be reject if not player's turn / turn is not the current turn
         *
         * Here we don't associate MissleFired event with turn. Users could rapidly click around where validations happen at server afterwards
         * (extra turn is granted when player hit a ship)
         * Edge case when events are fired from multiple devices and arrived out of order
         *
         */

        store.commit(
          events.ActionCompleted({
            id: lastMissile.id,
            gameId: currentGameId,
            player: myPlayer,
          })
        );
      },
    });

    // // Listen to ActionCompleted events to track turns
    // store.subscribe(gameActions$(currentGameId), {
    //   onUpdate: (actions) => {
    //     const lastAction = actions[0];
    //     if (lastAction) {
    //       // const ismyPlayerTurn = determineCurrentTurn(lastAction, players, myPlayer);
    //       // console.log(
    //       //   `🎯 Current turn: ${ismyPlayerTurn ? myPlayer : 'opponent'} (Turn #${lastAction.turn})`
    //       // );
    //     }
    //   },
    // });
  }

  // Create an Effect that logs every 5 seconds and monitors game state
  const loggingLoop = Effect.gen(function* () {
    let counter = 0;

    // Create a repeating effect that runs every 5 seconds
    yield* Effect.repeat(
      Effect.gen(function* () {
        counter++;

        // store.manualRefresh();

        const currenTurn = 0;

        const currentGame = store.query(currentGame$());

        if (currentGame) {
          // const missiles = store.query(missiles$(currentGame.id));
          // const actions = store.query(allGameActions$(currentGame.id));
          const lastAction = store.query(lastAction$(currentGame.id));

          state.currentTurn = lastAction?.turn ?? 0;

          console.log('turn', lastAction);

          yield* Console.log(
            `Hello from Effect! Counter: ${counter} - ${new Date().toISOString()} ${currenTurn} ${state.missleCount}`
          );
          yield* Console.log(`Game: ${currentGame.id}, Phase: ${currentGame.gamePhase},`);
          // yield* Console.log(
          //   `Missiles fired: ${missiles.length}, Actions taken: ${actions.length}`
          // );

          // yield store.shutdown();
          console.log('shutdown in 60 seconds');
          yield* Effect.sleep(60 * 1000);
        }
        // await store.shutdown();
      }),
      Schedule.spaced('5 seconds')
    );
  });

  // Run the Effect
  await Effect.runPromise(loggingLoop);
  // store.commit(
  //   events.todoCreated({ id: crypto.randomUUID(), text: 'Task created from node-adapter' })
  // );

  // TODO wait for syncing to be complete
  console.log('shutdown in 60 seconds');
  await new Promise((resolve) => setTimeout(resolve, 60 * 1000));
  console.log('shutdown');
};

main().catch(console.error);
