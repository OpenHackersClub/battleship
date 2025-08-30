import { makeAdapter } from '@livestore/adapter-node';
import { createStorePromise } from '@livestore/livestore';
import { makeCfSync } from '@livestore/sync-cf';
import { GAME_CONFIG, pickEmptyTarget, getMissileHitPosition } from '@battleship/domain';
import { HttpServer, HttpRouter, HttpServerResponse } from '@effect/platform';
import { listen } from './server';
import { events, schema } from '@battleship/schema';

import {
  currentGame$,
  missiles$,
  opponentShips$,
  lastAction$,
  missileResultsById$,
  allMissiles$,
} from '@battleship/schema/queries';

const LIVESTORE_SYNC_URL =
  (globalThis as any)?.process?.env?.LIVESTORE_SYNC_URL || 'ws://localhost:8787';
const PORT = Number((globalThis as any)?.process?.env?.VITE_SERVER_PORT) || 10000;

// TODO fix to use schema types
/**
 * Processes a missile and determines if it hits or misses opponent ships
 * @param store - The livestore instance
 * @param missile - The missile object to process
 * @param gameId - The current game ID
 * @param currentPlayer - The player who fired the missile
 * @param opponentPlayer - The opponent player
 * @returns Object containing hit result, missile result event, and next player
 */
const processMissile = (
  store: any,
  missile: any,
  gameId: string,
  currentPlayer: string,
  opponentPlayer: string
) => {
  // Get opponent ships to check for collision
  const opponentShips = opponentPlayer ? store.query(opponentShips$(gameId, opponentPlayer)) : [];

  // Check for collision using shared missile processing utilities
  const hitPosition = getMissileHitPosition(missile, opponentShips || []);
  const isHit = hitPosition !== undefined;

  console.log('Collision check:', isHit ? 'HIT!' : 'MISS', 'at position', hitPosition);

  // Create appropriate missile result event
  const missileResultEvent = isHit
    ? events.MissileHit({
        id: missile.id,
        gameId: gameId,
        x: missile.x,
        y: missile.y,
        player: currentPlayer,
        createdAt: new Date(),
      })
    : events.MissileMiss({
        id: missile.id,
        gameId: gameId,
        x: missile.x,
        y: missile.y,
        player: currentPlayer,
        createdAt: new Date(),
      });

  // Determine next player (if hit, current player gets another turn)
  const nextPlayer = isHit ? currentPlayer : opponentPlayer;

  return {
    isHit,
    hitPosition,
    missileResultEvent,
    nextPlayer,
  };
};

const agentTurn = (store: any, currentGame: any, myPlayer: string, opponentPlayer: string) => {
  console.log('🤖 Agent turn for player:', myPlayer, currentGame.currentTurn);

  const gameId = currentGame.id;

  // Get all missiles fired in this game to avoid duplicates
  const allFiredMissiles = store.query(allMissiles$(gameId)) || [];
  const firedCoordinates = new Set<string>(
    allFiredMissiles.map((missile: any) => `${missile.x},${missile.y}`)
  );

  console.log('Already fired at:', firedCoordinates.size, 'locations');

  const targetCell = pickEmptyTarget({
    rowSize: GAME_CONFIG.rowSize,
    colSize: GAME_CONFIG.colSize,
    firedCoordinates,
  });

  if (!targetCell) {
    console.log('🤖 No available cells to fire at');
    return;
  }

  console.log(`🤖 Agent firing at (${targetCell.x}, ${targetCell.y})`);

  // Create missile
  const missileId = crypto.randomUUID();
  const missile = {
    id: missileId,
    gameId: gameId,
    player: myPlayer,
    x: targetCell.x,
    y: targetCell.y,
    createdAt: new Date(),
  };

  // Add a small delay to ensure the missile is processed before we check results
  setTimeout(() => {
    // Fire the missile first
    store.commit(events.MissileFired(missile));
    // Process the missile result using our extracted function
    const { missileResultEvent, nextPlayer } = processMissile(
      store,
      missile,
      gameId,
      myPlayer,
      opponentPlayer
    );

    // Get current turn for action completion
    const lastAction = store.query(lastAction$(gameId));
    const newTurn = (lastAction?.turn ?? 0) + 1;

    // Commit the result
    store.commit(
      events.ActionCompleted({
        id: crypto.randomUUID(),
        gameId: gameId,
        player: myPlayer,
        turn: newTurn,
        nextPlayer: nextPlayer,
      }),
      missileResultEvent
    );

    console.log(`🤖 Agent turn completed. Next player: ${nextPlayer}`);
  }, 100); // Small delay to ensure missile is registered
};

const main = async () => {
  const adapter = makeAdapter({
    storage: { type: 'fs', baseDirectory: 'tmp' },
    sync: { backend: makeCfSync({ url: LIVESTORE_SYNC_URL }), onSyncError: 'ignore' },
  });

  const storeId = (globalThis as any)?.process?.env?.VITE_STORE_ID;
  if (!storeId) {
    throw new Error(
      'VITE_STORE_ID is not set in env variables. Configure same store id across all clients'
    );
  }

  // necessary to use same store id across all clients
  const store = await createStorePromise({
    adapter,
    schema,
    storeId,
    syncPayload: { authToken: 'insecure-token-change-me' },
  });

  await new Promise((resolve) => setTimeout(resolve, 5 * 1000));

  let lastGameId = '';
  let unsubscribeHandlers: (() => void)[] = [];

  store.subscribe(currentGame$(), {
    skipInitialRun: false,
    onUpdate: (currentGame: any) => {
      console.log('Server Store Id:', store.storeId);
      console.log('Current game:', currentGame);

      if (!currentGame) {
        return;
      }
      // onUpdate trigger on player update thus infinite loop
      if (lastGameId === currentGame.id) {
        return;
      }

      unsubscribeHandlers.map((unsubscribe) => unsubscribe?.());
      unsubscribeHandlers = [];
      lastGameId = currentGame.id;

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
      const unsubscribeMissiles = store.subscribe(missiles$(currentGameId, myPlayer) as any, {
        skipInitialRun: false,
        // Issue: when specified true, onUpdate effect not being trigger even aftewards

        onSubscribe: () => {
          console.log('subscribed = missiles');
        },
        onUpdate: (missiles: any[]) => {
          console.log('🚀 Missiles fired:', missiles.length, 'myPlayer', myPlayer, currentGame);

          if (missiles.length <= 0) {
            return;
          }

          const lastMissile = missiles?.[0];

          console.log('missile', lastMissile.id, missiles?.[0]?.x, missiles?.[0]?.y);

          // Process missile to determine hit/miss and create result event
          const { missileResultEvent, nextPlayer } = processMissile(
            store,
            lastMissile,
            currentGameId,
            myPlayer,
            opponentPlayer
          );

          const lastAction = store.query(lastAction$(currentGameId)) as any;

          // store.query(lastMissile$(currentGameId, myPlayer));

          const missileResult = store.query(
            missileResultsById$(currentGameId, lastMissile.id)
          ) as any[];

          console.log('missile result', missileResult);

          if (missileResult?.length > 0) {
            return;
          }

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

          // workaround issue https://github.com/livestorejs/livestore/issues/577 by commiting at next tick
          // error TypeError: Cannot read properties of undefined (reading 'refreshedAtoms')
          setTimeout(() => {
            // Fire either MissileHit or MissileMiss event based on collision result
            store.commit(
              events.ActionCompleted({
                id: crypto.randomUUID(),
                gameId: currentGameId,
                player: myPlayer,
                turn: newTurn,
                nextPlayer: nextPlayer,
              }),
              missileResultEvent
            );
          }, 1);
        },
      });

      // separate loop to . Could live in another client
      const unsubscribeLastAction = store.subscribe(lastAction$(currentGameId), {
        onUpdate: (action: any) => {
          console.log('action updated', action);

          const game = store.query(currentGame$()) as any;

          // currentPlayer

          console.log('next player', game?.currentPlayer);

          if (game?.currentPlayer === 'player-2') {
            agentTurn(store, currentGame, 'player-2', 'player-1');
          }
        },
      });

      unsubscribeHandlers.push(unsubscribeMissiles, unsubscribeLastAction);
    },
  });
};

// Define the router with a single route for the root URL
const router = HttpRouter.empty.pipe(HttpRouter.get('/health', HttpServerResponse.text('ok')));
// Set up the application server with logging
const app = router.pipe(HttpServer.serve(), HttpServer.withLogAddress);

listen(app, PORT);

main().catch(console.error);
