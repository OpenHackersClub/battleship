import { allMissiles$, currentGame$ } from '@battleship/schema/queries';
import { useQuery, useStore } from '@livestore/react';
import type React from 'react';
import { useGameState } from './GameStateProvider';
import { Alert, AlertDescription } from './ui/alert';
// import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger } from './ui/menubar';
import { Button } from './ui/button';

export const Header: React.FC = () => {
  const { store } = useStore();

  const currentGame = useQuery(currentGame$());

  const { currentGameId, newGame } = useGameState();

  const missiles = store.useQuery(allMissiles$(currentGameId ?? ''));

  const handleStartNewGame = () => {
    newGame();
  };

  return (
    <header className="mb-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Battleship</h1>

        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            {currentGameId ? (
              <span>
                Game: <span className="font-mono">{currentGameId}</span>
              </span>
            ) : (
              <span>No game</span>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span>Current player:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-gray-800 text-white text-xs font-medium">
              {currentGame?.currentPlayer ?? ''}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span>Turn:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-gray-800 text-white text-xs font-medium">
              {currentGame?.currentTurn ?? 0}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span>Fired:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-gray-800 text-white text-xs font-medium">
              {missiles?.length ?? 0}
            </span>
          </div>

          <Button variant="outline" onClick={handleStartNewGame}>
            Start New Game
          </Button>
        </div>
      </div>

      <Alert className="mt-4 mb-4 text-center">
        <AlertDescription>
          1. Drag & Drop your ships 2. Start 3. Click on enemy waters to fire missiles!
        </AlertDescription>
      </Alert>
    </header>
  );
};
