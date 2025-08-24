import { missileResults$, gameActions$, allMissiles$ } from '@battleship/schema/queries';
import { tables } from '@battleship/schema/schema';

import { useDragDropMonitor } from '@dnd-kit/react';
import { useClientDocument, useStore, useQuery } from '@livestore/react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MySeaGrid } from './MySeaGrid';
import { OpponentSeaGrid } from './OpponentSeaGrid';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Separator } from './ui/separator';

export const PlayerTitle = ({ playerName }: { playerName: string }) => {
  return (
    <div className="mt-4 flex justify-center items-center gap-3 ">
      <Avatar>
        <AvatarImage
          src={`https://api.dicebear.com/8.x/identicon/svg?seed=${playerName}`}
          alt={playerName}
        />
        <AvatarFallback>{playerName.slice(0, 2)}</AvatarFallback>
      </Avatar>
      <div className="text-sm font-medium">{playerName}</div>
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
        actionText = `🚀 Fired at (${missile.x}, ${missile.y}) ${result}`;
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
          actionLog.map((log, index) => (
            <div key={index} className="bg-white p-2 rounded border shadow-sm">
              <div className="flex justify-between items-start mb-1">
                <div className="text-xs">
                  <span className="font-medium text-blue-600">Turn {log.turn}</span>
                  <span className="mx-1 text-gray-400">•</span>
                  <span className="font-medium">{log.player}</span>
                </div>
              </div>
              <div className="text-xs text-gray-700">{log.action}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const MainSection: React.FC = () => {
  const [{ currentGameId, myPlayer, opponent }, setState] = useClientDocument(tables.uiState);
  const { store } = useStore();

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

  if (!currentGameId) {
    return <div />;
  }

  return (
    <section className="main">
      <div className="flex gap-8 justify-center items-start p-4 w-full max-w-7xl mx-auto">
        <div className="flex-1 min-w-80">
          <MySeaGrid player={myPlayer} />
          <PlayerTitle playerName={myPlayer} />
        </div>
        <Separator orientation="vertical" className="h-96 w-px bg-gray-400" />
        <div className="flex-1 min-w-80">
          <OpponentSeaGrid player={opponent} />
          <PlayerTitle playerName={opponent} />
        </div>
        <Separator orientation="vertical" className="h-96 w-px bg-gray-400" />
        <div className="flex-1 min-w-60">
          <ActionLog gameId={currentGameId} />
        </div>
      </div>
    </section>
  );
};
