import type React from 'react';

import { useDragDropMonitor } from '@dnd-kit/react';
import { useClientDocument } from '@livestore/react';
import { Separator } from './ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

import { tables } from '../livestore/schema';
import { MySeaGrid } from './MySeaGrid';
import { OpponentSeaGrid } from './OpponentSeaGrid';

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
  const [{ currentGameId, currentPlayer, opponent }, setState] = useClientDocument(tables.uiState);
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
          <MySeaGrid player={currentPlayer} />
          <PlayerTitle playerName={currentPlayer} />
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
