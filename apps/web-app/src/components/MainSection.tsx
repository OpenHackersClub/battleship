import { missileResults$ } from '@battleship/schema/queries';
import { tables } from '@battleship/schema/schema';

import { useDragDropMonitor } from '@dnd-kit/react';
import { useClientDocument, useStore } from '@livestore/react';
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
      <div className="flex gap-8 justify-center items-start p-8 w-full max-w-6xl mx-auto">
        <div className="flex-1">
          <MySeaGrid player={myPlayer} />
          <PlayerTitle playerName={myPlayer} />
        </div>
        <Separator orientation="vertical" className="h-96 w-px bg-gray-400" />
        <div className="flex-1">
          <OpponentSeaGrid player={opponent} />
          <PlayerTitle playerName={opponent} />
        </div>
      </div>
    </section>
  );
};
