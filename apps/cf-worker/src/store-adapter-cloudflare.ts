import type {
  GameData,
  LastActionData,
  MissileData,
  MissileResultData,
  StoreAdapter,
} from '@battleship/agent';
import type { SeaObject } from '@battleship/domain';
import { events } from '@battleship/schema';
import {
  allMissiles$,
  currentGame$,
  lastAction$,
  missileResults$,
  missileResultsById$,
  opponentShips$,
} from '@battleship/schema/queries';
import type { createStoreDoPromise } from '@livestore/adapter-cloudflare';

type LiveStoreInstance = ReturnType<typeof createStoreDoPromise> extends Promise<infer T>
  ? T
  : never;

/**
 * Cloudflare Durable Object store adapter implementation.
 * Wraps the Livestore instance to provide a platform-agnostic interface for the agent.
 */
export class CloudflareStoreAdapter implements StoreAdapter {
  constructor(private store: LiveStoreInstance) {}

  getAllMissiles(gameId: string): MissileData[] {
    return ((this.store as any).query(allMissiles$(gameId)) as MissileData[]) || [];
  }

  getOpponentShips(gameId: string, opponentPlayer: string): SeaObject[] {
    return ((this.store as any).query(opponentShips$(gameId, opponentPlayer)) as SeaObject[]) || [];
  }

  getMissileResults(gameId: string, player: string): MissileResultData[] {
    return (
      ((this.store as any).query(missileResults$(gameId, player)) as MissileResultData[]) || []
    );
  }

  getMissileResultById(gameId: string, missileId: string): MissileResultData[] {
    return (
      ((this.store as any).query(missileResultsById$(gameId, missileId)) as MissileResultData[]) ||
      []
    );
  }

  getLastAction(gameId: string): LastActionData | null {
    return (this.store as any).query(lastAction$(gameId)) as LastActionData | null;
  }

  getCurrentGame(): GameData | null {
    return (this.store as any).query(currentGame$()) as GameData | null;
  }

  commitMissileFired(missile: {
    id: string;
    gameId: string;
    player: string;
    x: number;
    y: number;
    createdAt: Date;
  }): void {
    (this.store as any).commit(events.MissileFired(missile));
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
    (this.store as any).commit(events.ActionCompleted(actionCompleted), missileResultEvent);
  }
}
