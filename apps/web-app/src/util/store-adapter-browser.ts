import type {
  GameData,
  LastActionData,
  MissileData,
  MissileResultData,
  StoreAdapter,
} from '@battleship/agent';
import type { SeaObject } from '@battleship/domain';
import {
  allMissiles$,
  currentGame$,
  lastAction$,
  missileResults$,
  missileResultsById$,
  opponentShips$,
} from '@battleship/schema/queries';
import { events } from '../schema/schema';

/**
 * Browser store adapter implementation.
 * Wraps the Livestore instance to provide a platform-agnostic interface for the agent.
 */
export class BrowserStoreAdapter implements StoreAdapter {
  // biome-ignore lint/suspicious/noExplicitAny: Store type avoided to prevent build-time type errors
  constructor(private store: any) {}

  getAllMissiles(gameId: string): MissileData[] {
    return (this.store.query(allMissiles$(gameId)) as MissileData[]) || [];
  }

  getOpponentShips(gameId: string, opponentPlayer: string): SeaObject[] {
    return (this.store.query(opponentShips$(gameId, opponentPlayer)) as SeaObject[]) || [];
  }

  getMissileResults(gameId: string, player: string): MissileResultData[] {
    return (this.store.query(missileResults$(gameId, player)) as MissileResultData[]) || [];
  }

  getMissileResultById(gameId: string, missileId: string): MissileResultData[] {
    return (this.store.query(missileResultsById$(gameId, missileId)) as MissileResultData[]) || [];
  }

  getLastAction(gameId: string): LastActionData | null {
    return this.store.query(lastAction$(gameId)) as LastActionData | null;
  }

  getCurrentGame(): GameData | null {
    return this.store.query(currentGame$()) as GameData | null;
  }

  commitMissileFired(missile: {
    id: string;
    gameId: string;
    player: string;
    x: number;
    y: number;
    createdAt: Date;
  }): void {
    this.store.commit(events.MissileFired(missile));
  }

  commitMissileResult(
    actionCompleted: {
      id: string;
      gameId: string;
      player: string;
      turn: number;
      nextPlayer: string;
    },
    missileResultEvent: unknown
  ): void {
    this.store.commit(events.ActionCompleted(actionCompleted), missileResultEvent);
  }
}
