import type { Store } from '@livestore/react';
import { events, GamePhase } from '../schema/schema';

export interface GameStartParams {
  currentGameId: string;
  myPlayer: string;
  opponent: string;
  currentGame?: {
    players?: readonly string[];
    createdAt?: Date;
  };
}

export class GameService {
  private store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  /**
   * Updates the game phase to Playing when players are ready
   */
  startGame(params: GameStartParams): void {
    const { currentGameId, myPlayer, opponent, currentGame } = params;

    if (!currentGameId) {
      console.warn('Cannot start game: no current game ID');
      return;
    }

    this.store.commit(
      events.GameUpdated({
        id: currentGameId,
        gamePhase: GamePhase.Playing,
        players: currentGame?.players ? [...currentGame.players] : [myPlayer, opponent],
        createdAt: currentGame?.createdAt || new Date(),
      })
    );
  }
}
