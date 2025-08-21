import { queryDb } from '@livestore/livestore';
import { useStore } from '@livestore/react';
import type React from 'react';
import { useMemo } from 'react';
import { events, tables } from '@/livestore/schema';
import { useGameState } from './GameStateProvider';
import { Alert, AlertDescription } from './ui/alert';
// import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger } from './ui/menubar';
import { Button } from './ui/button';

export const Header: React.FC = () => {
  const { store } = useStore();

  const { currentGameId } = useGameState();

  const missiles$ = useMemo(
    () => queryDb(tables.missles.select(), { label: 'missiles-header' }),
    []
  );
  const missiles = store.useQuery(missiles$);

  const handleStartNewGame = () => {
    const id = `game-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    store.commit(events.GameStarted({ id, gamePhase: 'setup', createdAt: new Date() }));
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
          Click on your grid to place ships, click on enemy waters to fire missiles!
        </AlertDescription>
      </Alert>
    </header>
  );
};
