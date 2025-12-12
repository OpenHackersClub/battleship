// Avoid importing Store type; use structural typing to prevent build-time type errors

import { agentTurn, processMissileWithSemaphore } from '@battleship/agent';
import { Effect, Logger, TSemaphore } from 'effect';
import { events, GamePhase } from '../schema/schema';
import { BrowserAgentAIProvider } from './browser-agent-ai-provider';
import { BrowserStoreAdapter } from './store-adapter-browser';

export interface GameStartParams {
  currentGameId: string;
  myPlayer: string;
  opponent: string;
  aiPlayerType: 'openai' | 'browserai';
  currentGame?: {
    players?: readonly string[];
    createdAt?: Date;
  };
}

export class GameService {
  // biome-ignore lint/suspicious/noExplicitAny: Store type avoided to prevent build-time type errors
  private store: any;
  private isAgentRunning: boolean = false;
  private semaphore: TSemaphore.TSemaphore | null = null;

  // biome-ignore lint/suspicious/noExplicitAny: Store type avoided to prevent build-time type errors
  constructor(store: any) {
    this.store = store;
    // Initialize semaphore asynchronously
    this.initSemaphore();
  }

  private async initSemaphore(): Promise<void> {
    this.semaphore = await Effect.runPromise(TSemaphore.make(1));
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
        aiPlayerType: params?.aiPlayerType || 'openai',
        players: currentGame?.players ? [...currentGame.players] : [myPlayer, opponent],
        createdAt: currentGame?.createdAt || new Date(),
      })
    );
  }

  /**
   * Run a single Browser-AI agent turn locally in the browser.
   * Uses the shared agentTurn function from @battleship/agent.
   * Safely no-ops if already running or if no available targets.
   */
  async runBrowserAgentTurn(params: {
    currentGameId: string;
    myPlayer: string;
    opponent: string;
  }): Promise<void> {
    if (this.isAgentRunning) return;
    this.isAgentRunning = true;

    try {
      const { currentGameId, myPlayer, opponent } = params;

      // Ensure semaphore is initialized
      if (!this.semaphore) {
        this.semaphore = await Effect.runPromise(TSemaphore.make(1));
      }

      // Create adapters for browser environment
      const storeAdapter = new BrowserStoreAdapter(this.store);
      const aiProvider = new BrowserAgentAIProvider();

      // Get current game state
      const currentGame = storeAdapter.getCurrentGame();
      if (!currentGame) {
        console.warn('No current game found');
        return;
      }

      // Run the shared agent turn logic
      await Effect.runPromise(
        agentTurn({
          store: storeAdapter,
          currentGame: {
            id: currentGameId,
            currentTurn: currentGame.currentTurn,
            currentPlayer: myPlayer,
            players: [myPlayer, opponent],
          },
          myPlayer,
          opponentPlayer: opponent,
          semaphore: this.semaphore,
          aiProvider,
        }).pipe(Effect.provide(Logger.pretty))
      );
    } catch (err) {
      console.error('Browser agent turn failed:', err);
    } finally {
      this.isAgentRunning = false;
    }
  }

  /**
   * Process a user's missile in browser AI mode.
   * This determines hit/miss and commits the ActionCompleted event to update the turn.
   * Without this, the game would get stuck waiting for server processing that doesn't exist in browser mode.
   */
  async processUserMissile(params: {
    missileId: string;
    currentGameId: string;
    myPlayer: string;
    opponent: string;
    x: number;
    y: number;
  }): Promise<void> {
    try {
      const { missileId, currentGameId, myPlayer, opponent, x, y } = params;

      // Ensure semaphore is initialized
      if (!this.semaphore) {
        this.semaphore = await Effect.runPromise(TSemaphore.make(1));
      }

      const storeAdapter = new BrowserStoreAdapter(this.store);

      // Process the missile to determine hit/miss and update turn
      await Effect.runPromise(
        processMissileWithSemaphore(
          storeAdapter,
          { id: missileId, x, y, player: myPlayer },
          currentGameId,
          myPlayer,
          opponent,
          this.semaphore
        ).pipe(Effect.provide(Logger.pretty))
      );
    } catch (err) {
      console.error('Process user missile failed:', err);
    }
  }
}
