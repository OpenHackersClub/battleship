// Avoid importing Store type; use structural typing to prevent build-time type errors

import {
  GAME_CONFIG,
  getMissileHitPosition,
  type MissileResult,
  type StrategyContext,
} from '@battleship/domain';
import {
  allMissiles$,
  lastAction$,
  missileResults$,
  opponentShips$,
} from '@battleship/schema/queries';
import { events, GamePhase } from '../schema/schema';
import { checkBrowserAiAvailability, generateObjectWithBrowserAI } from './browser-ai-provider';

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
  private store: any;
  private isAgentRunning: boolean = false;

  constructor(store: any) {
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
        aiPlayerType: params?.aiPlayerType || 'openai',
        players: currentGame?.players ? [...currentGame.players] : [myPlayer, opponent],
        createdAt: currentGame?.createdAt || new Date(),
      })
    );
  }

  /**
   * Run a single Browser-AI agent turn locally in the browser.
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
      // Build fired set
      const allFiredMissiles = (this.store as any).query(allMissiles$(currentGameId)) || [];
      const firedCoordinates = new Set<string>(
        allFiredMissiles.map((missile: any) => `${missile.x},${missile.y}`)
      );

      // Available targets
      const availableTargets: { x: number; y: number }[] = [];
      for (let x = 0; x < GAME_CONFIG.colSize; x++) {
        for (let y = 0; y < GAME_CONFIG.rowSize; y++) {
          const key = `${x},${y}`;
          if (!firedCoordinates.has(key)) availableTargets.push({ x, y });
        }
      }

      if (availableTargets.length === 0) return;

      // Build strategy context
      const opponentMissileResults =
        (this.store as any).query(missileResults$(currentGameId, opponent)) || [];
      const opponentHits: MissileResult[] = opponentMissileResults
        .filter((r: any) => r.isHit)
        .map((r: any) => ({ id: r.id, x: r.x, y: r.y, player: r.player }));
      const opponentMisses: MissileResult[] = opponentMissileResults
        .filter((r: any) => !r.isHit)
        .map((r: any) => ({ id: r.id, x: r.x, y: r.y, player: r.player }));

      const strategyContext: StrategyContext = {
        gridSize: { rowSize: GAME_CONFIG.rowSize, colSize: GAME_CONFIG.colSize },
        availableTargets,
        opponentHits,
        opponentMisses,
      };

      // Prompt for Browser AI
      const prompt = this.generateBattleshipPrompt(strategyContext);

      // Ensure Browser AI ready
      const availability = await checkBrowserAiAvailability();
      if (availability !== 'available') return;

      const response = await generateObjectWithBrowserAI<{
        x: number;
        y: number;
        reasoning: string;
      }>({
        prompt,
        temperature: 0.7,
        topK: 3,
      });

      const selected = this.validateCoordinateOrFallback(
        { x: response.value.x, y: response.value.y },
        availableTargets,
        'Browser AI'
      );

      if (!selected) return;

      // Create and commit missile
      const missileId = crypto.randomUUID();
      const missile = {
        id: missileId,
        gameId: currentGameId,
        player: myPlayer,
        x: selected.x,
        y: selected.y,
        createdAt: new Date(),
      };

      // Commit fire
      this.store.commit(events.MissileFired(missile));

      // Process missile locally (determine hit/miss and next player)
      const opponentShips =
        (this.store as any).query(opponentShips$(currentGameId, opponent)) || [];
      const { missileResultEvent, nextPlayer } = this.processMissile(
        missile,
        myPlayer,
        opponent,
        opponentShips
      );

      // Small delay to allow subscribers to stabilize
      await new Promise((r) => setTimeout(r, 50));
      this.store.commit(
        events.ActionCompleted({
          id: crypto.randomUUID(),
          gameId: currentGameId,
          player: myPlayer,
          turn: (((this.store as any).query(lastAction$(currentGameId)) as any)?.turn ?? 0) + 1,
          nextPlayer,
        }) as any,
        missileResultEvent as any
      );
    } catch (err) {
      console.error(err);
    } finally {
      this.isAgentRunning = false;
    }
  }

  private processMissile(
    missile: { id: string; gameId: string; player: string; x: number; y: number; createdAt: Date },
    currentPlayer: string,
    opponentPlayer: string,
    opponentShips: any[]
  ): { missileResultEvent: any; nextPlayer: string } {
    const hitPosition = getMissileHitPosition(missile as any, opponentShips || []);
    const isHit = hitPosition !== undefined;

    const missileResultEvent = isHit
      ? events.MissileHit({
          id: missile.id,
          gameId: missile.gameId,
          x: missile.x,
          y: missile.y,
          player: currentPlayer,
          createdAt: new Date(),
        })
      : events.MissileMiss({
          id: missile.id,
          gameId: missile.gameId,
          x: missile.x,
          y: missile.y,
          player: currentPlayer,
          createdAt: new Date(),
        });

    const nextPlayer = isHit ? currentPlayer : opponentPlayer;
    return { missileResultEvent, nextPlayer };
  }

  private generateBattleshipPrompt(context: StrategyContext): string {
    return `You are an expert Battleship AI strategist. Analyze the current game state and select the optimal coordinate to maximize winning probability.

GAME STATE:
- Grid: ${context.gridSize.rowSize}x${context.gridSize.colSize}
- Available targets: ${JSON.stringify(context.availableTargets)}
- Opponent hits: ${JSON.stringify(context.opponentHits)}
- Opponent misses: ${JSON.stringify(context.opponentMisses)}

STRATEGIC OBJECTIVES:
1. Use probability-based targeting for maximum ship-finding efficiency
2. Consider ship lengths (1-3 cells) and optimal spacing patterns
3. Target areas that maximize the probability of hitting a ship

You must respond with a JSON object containing your chosen coordinate and reasoning.
The coordinate MUST be from the available targets list.`;
  }

  private validateCoordinateOrFallback(
    selectedCoord: { x: number; y: number },
    availableCoords: ReadonlyArray<{ x: number; y: number }>,
    aiType: string
  ): { x: number; y: number } | null {
    const isValid = globalThis.Array.from(availableCoords).some(
      (c) => c.x === selectedCoord.x && c.y === selectedCoord.y
    );
    if (!isValid) {
      console.warn(`⚠️ ${aiType} selected invalid coordinate, falling back to random selection`);
      const randomIndex = Math.floor(Math.random() * availableCoords.length);
      return availableCoords[randomIndex] || null;
    }
    return selectedCoord;
  }
}
