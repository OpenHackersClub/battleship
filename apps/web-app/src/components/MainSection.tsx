import { areAllShipsSunk, getShipPositions } from '@battleship/domain';
import {
  allMissiles$,
  currentGame$,
  gameActions$,
  missileResults$,
  opponentShips$,
} from '@battleship/schema/queries';
import { useDragDropMonitor } from '@dnd-kit/react';
import { useClientDocument, useQuery, useStore } from '@livestore/react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { events, GamePhase, tables } from '../schema/schema';
import { GameService } from '../util/gameService';
import { type AiPlayerType, AiPlayerTypeSelector } from './AiPlayerTypeSelector';
import { useGameState } from './GameStateProvider';
import { MySeaGrid } from './MySeaGrid';
import { OpponentSeaGrid } from './OpponentSeaGrid';
import { ShipDisplay } from './ShipDisplay';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Separator } from './ui/separator';

export const PlayerTitle = ({
  playerName,
  shipsRemaining,
  isWinner,
}: {
  playerName: string;
  shipsRemaining?: number;
  isWinner?: boolean;
}) => {
  return (
    <div className={`mb-3 flex flex-col items-center gap-2 p-3 rounded-lg ${isWinner ? 'bg-gradient-to-r from-yellow-100 to-amber-100 animate-winner-pulse' : ''}`}>
      <Avatar className={`h-12 w-12 ${isWinner ? 'animate-winner ring-4 ring-yellow-400' : ''}`}>
        <AvatarImage
          src={`https://api.dicebear.com/8.x/identicon/svg?seed=${playerName}`}
          alt={playerName}
        />
        <AvatarFallback>{playerName.slice(0, 2)}</AvatarFallback>
      </Avatar>
      <div className={`text-sm font-semibold ${isWinner ? 'text-amber-700 animate-winner' : ''}`}>
        {isWinner && '🏆 '}
        {playerName}
        {isWinner && ' 🏆'}
      </div>
      {shipsRemaining !== undefined && (
        <div className="text-xs text-gray-600">
          🚢 {shipsRemaining} ships remaining
        </div>
      )}
    </div>
  );
};

const ActionLog = ({ gameId }: { gameId: string }) => {
  const actions = useQuery(gameActions$(gameId));
  const allMissiles = useQuery(allMissiles$(gameId));
  const [{ myPlayer, opponent }] = useClientDocument(tables.uiState);

  const myMissileResults = useQuery(missileResults$(gameId, myPlayer));
  const opponentMissileResults = useQuery(missileResults$(gameId, opponent));

  const actionLog = useMemo(() => {
    if (!actions || !allMissiles) return [];

    const allMissileResults = [...(myMissileResults || []), ...(opponentMissileResults || [])];

    return actions.map((action) => {
      const missiles = allMissiles.filter((m) => m.player === action.player);
      const missileResult = allMissileResults.find((mr) => mr.player === action.player);

      let actionText = 'Completed turn';
      if (missiles.length > 0) {
        const missile = missiles[0];
        const result = missileResult ? (missileResult.isHit ? '🎯 HIT!' : '💨 MISS') : '';
        actionText = `🚀 (${missile.x}, ${missile.y}) ${result}`;
      }

      return {
        turn: action.turn,
        player: action.player,
        action: actionText,
        timestamp: new Date().toLocaleTimeString(),
      };
    });
  }, [actions, allMissiles, myMissileResults, opponentMissileResults]);

  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <h3 className="text-xs font-semibold mb-3">🎯 Action Log</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {actionLog.length === 0 ? (
          <p className="text-gray-500 text-xs">No actions yet</p>
        ) : (
          actionLog.map((action) => (
            <div
              key={`${action.turn}-${action.player}`}
              className="bg-white p-2 rounded border shadow-sm"
            >
              <div className="flex flex-row justify-between items-start mb-1">
                <div className="text-xs">
                  <span className="font-medium text-blue-600">Turn {action.turn}</span>
                  <span className="mx-1 text-gray-400">•</span>
                  <span className="font-medium">{action.player}</span>
                  <span className="mx-1 text-gray-400">•</span>
                  <span className="text-xs text-gray-700">{action.action}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const MainSection: React.FC = () => {
  const [{ currentGameId, myPlayer, opponent, winner, myShips }, setState] = useClientDocument(
    tables.uiState
  );
  const { store } = useStore();
  const { newGame } = useGameState();

  // AI Player Type selection state
  const [selectedAiType, setSelectedAiType] = useState<AiPlayerType>('openai');

  // Initialize game service
  const gameService = useMemo(() => new GameService(store), [store]);

  // Get current game to check phase
  const currentGame = useQuery(currentGame$());

  // Get missile results for both players
  const myMissileResults = useQuery(missileResults$(currentGameId || '', myPlayer));
  const opponentMissileResults = useQuery(missileResults$(currentGameId || '', opponent));

  // Get opponent ships
  const opponentShips = store.useQuery(opponentShips$(currentGameId || '', opponent));

  // Check for winner whenever missile results change
  useEffect(() => {
    if (!currentGameId || !myPlayer || !opponent || winner) return;
    if (!myMissileResults || !opponentMissileResults || !myShips || !opponentShips) return;

    // Check if I won (all opponent ships sunk by my missiles)
    const opponentShipsSunk = areAllShipsSunk([...opponentShips], [...myMissileResults]);

    // Check if opponent won (all my ships sunk by opponent missiles)
    const myShipsSunk = areAllShipsSunk([...myShips], [...opponentMissileResults]);

    if (opponentShipsSunk) {
      console.log(`🎉 GAME WON! ${myPlayer} has sunk all of ${opponent}'s ships!`);
      setState({ winner: myPlayer });
    } else if (myShipsSunk) {
      console.log(`💔 GAME LOST! ${opponent} has sunk all of ${myPlayer}'s ships!`);
      setState({ winner: opponent });
    }
  }, [
    currentGameId,
    myPlayer,
    opponent,
    winner,
    myMissileResults,
    opponentMissileResults,
    myShips,
    opponentShips,
    setState,
  ]);

  // Add drag drop monitor for logging all events
  useDragDropMonitor({
    onBeforeDragStart: (event, manager) => {
      console.log('🚀 onBeforeDragStart:', event, manager);
    },
    onDragStart: (event, manager) => {
      console.log('🎯 onDragStart:', event, manager);
    },
    onDragMove: (event, manager) => {
      console.log('🔄 onDragMove:', event, manager);
    },
    onDragOver: (event, manager) => {
      console.log('👆 onDragOver:', event, manager);
    },
    onCollision: (event, manager) => {
      console.log('💥 onCollision:', event, manager);
    },
    onDragEnd: (event, manager) => {
      console.log('🏁 onDragEnd:', event, manager);
    },
  });

  // When using Browser AI and it's the AI's turn, run the agent turn locally
  const agentRunningRef = useRef(false);
  useEffect(() => {
    if (!currentGame) return;
    if (currentGame.gamePhase !== GamePhase.Playing) return;
    const aiType = (currentGame.aiPlayerType as AiPlayerType) || 'openai';
    if (aiType !== 'browserai') return;
    if (currentGame.currentPlayer !== opponent) return;
    if (agentRunningRef.current) return;

    agentRunningRef.current = true;
    gameService.runBrowserAgentTurn({
      currentGameId: currentGameId || '',
      myPlayer: opponent,
      opponent: myPlayer,
    });
    const t = setTimeout(() => {
      agentRunningRef.current = false;
    }, 500);
    return () => clearTimeout(t);
  }, [currentGame, currentGameId, myPlayer, opponent, gameService]);

  // Helper function to count ships alive for a player
  const countShipsAlive = useMemo(() => {
    if (!myShips || !opponentShips || !myMissileResults || !opponentMissileResults) {
      return { myShipsAlive: 0, opponentShipsAlive: 0 };
    }

    const countAlive = (ships: typeof myShips, missileResults: typeof myMissileResults) => {
      if (!ships || ships.length === 0) return 0;

      const hitPositions = new Set(
        missileResults.filter((result) => result.isHit).map((result) => `${result.x},${result.y}`)
      );

      return ships.filter((ship) => {
        const shipPositions = getShipPositions(ship);
        return !shipPositions.every((pos) => hitPositions.has(`${pos.x},${pos.y}`));
      }).length;
    };

    return {
      myShipsAlive: countAlive(myShips, opponentMissileResults || []),
      opponentShipsAlive: countAlive(opponentShips, myMissileResults || []),
    };
  }, [myShips, opponentShips, myMissileResults, opponentMissileResults]);

  return (
    <section className="main">
      <div className="flex gap-4 justify-center items-start p-4 w-full max-w-7xl mx-auto">
        <div className="flex-1 min-w-80">
          <PlayerTitle
            playerName={myPlayer}
            shipsRemaining={currentGame?.gamePhase === GamePhase.Playing ? countShipsAlive.myShipsAlive : undefined}
            isWinner={winner === myPlayer}
          />
          <MySeaGrid player={myPlayer} />
          {currentGameId && <ShipDisplay ships={[...(myShips || [])]} title="My Ships" />}
        </div>
        <Separator orientation="vertical" className="h-96 w-px bg-gray-400" />
        <div className="flex-1 min-w-80">
          <PlayerTitle
            playerName={opponent}
            shipsRemaining={currentGame?.gamePhase === GamePhase.Playing ? countShipsAlive.opponentShipsAlive : undefined}
            isWinner={winner === opponent}
          />
          <OpponentSeaGrid player={opponent} />
          {currentGameId && (
            <ShipDisplay ships={[...(opponentShips || [])]} title={`${opponent}'s Ships`} />
          )}
        </div>
        <Separator orientation="vertical" className="h-96 w-px bg-gray-400" />
        <div className="flex-1 min-w-80">
          <div className="mb-4">
            {!currentGame && (
              <div className="space-y-4 mb-4">
                <AiPlayerTypeSelector
                  value={selectedAiType}
                  onChange={setSelectedAiType}
                  disabled={false}
                />
                <Button
                  onClick={() => newGame(selectedAiType)}
                  variant="outline"
                  className="w-full"
                >
                  🚢 New Game
                </Button>
              </div>
            )}

            {currentGame && (
              <>
                <Button
                  onClick={() => newGame(selectedAiType)}
                  variant="outline"
                  className="w-full mb-2"
                >
                  🚢 New Game
                </Button>

                {/* Show AI type selector during game as well */}
                <div className="mb-4">
                  <AiPlayerTypeSelector
                    value={(currentGame.aiPlayerType as AiPlayerType) || selectedAiType}
                    onChange={(type) => {
                      setSelectedAiType(type);
                      // If we're in setup phase, update the game's AI type as well
                      if (currentGame.gamePhase === GamePhase.Setup && currentGameId) {
                        store.commit(
                          events.GameUpdated({
                            id: currentGameId,
                            aiPlayerType: type,
                          })
                        );
                      }
                    }}
                    disabled={currentGame.gamePhase !== GamePhase.Setup}
                  />
                </div>

                {currentGame?.gamePhase === GamePhase.Setup && (
                  <Button
                    onClick={() => {
                      gameService.startGame({
                        currentGameId: currentGameId || '',
                        myPlayer,
                        opponent,
                        aiPlayerType: currentGame.aiPlayerType || selectedAiType,
                        currentGame,
                      });
                    }}
                    variant="default"
                    size="lg"
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
                  >
                    🚀 I'm Ready!
                  </Button>
                )}
                {currentGame?.gamePhase === GamePhase.Playing && (
                  <div className="w-full text-center text-green-600 font-semibold py-2 px-4 rounded bg-green-50 border border-green-200">
                    🎮 Game Started
                  </div>
                )}
              </>
            )}
          </div>
          {currentGameId && <ActionLog gameId={currentGameId} />}
        </div>
      </div>
    </section>
  );
};
