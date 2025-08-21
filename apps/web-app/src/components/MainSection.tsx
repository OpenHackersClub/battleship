import { useDragDropMonitor, useDraggable } from '@dnd-kit/react';
import { queryDb } from '@livestore/livestore';
import { useClientDocument, useStore } from '@livestore/react';
import type React from 'react';
import { useState } from 'react';

import { events, tables } from '../livestore/schema.js';
import { useGameState } from './GameStateProvider.js';
import { MySeaGrid } from './MySeaGrid.js';
import { OpponentSeaGrid } from './OpponentSeaGrid.js';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Separator } from './ui/separator';

interface Block {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface Ship {
  id: string;
  x: number;
  y: number;
  player: number;
}

interface Missile {
  id: string;
  x: number;
  y: number;
  player: number;
}

interface GridProps {
  title: string;
  size: number;
  ships: readonly Ship[];
  missiles: readonly Missile[];
  onCellClick?: (x: number, y: number) => void;
  showPlayerShips?: boolean;
  playerNumber?: number;
  blocks?: Block[];
  onBlockMove?: (blockId: string, x: number, y: number) => void;
}

interface DraggableBlockProps {
  block: Block;
  gridSize: number;
}

const DraggableBlock: React.FC<DraggableBlockProps> = ({ block }) => {
  console.log('DraggableBlock render:', block);
  const { ref } = useDraggable({
    id: block.id,
  });

  const style = {
    position: 'absolute' as const,
    left: block.x * 41 + 5,
    top: block.y * 41 + 5,
    width: block.width * 40 + (block.width - 1),
    height: block.height * 40 + (block.height - 1),
    backgroundColor: block.color,
  };

  return (
    <div
      ref={ref}
      className="absolute border-2 border-gray-800 rounded cursor-grab flex items-center justify-center text-xs font-bold text-white z-[1000] pointer-events-auto"
      style={{
        textShadow: '1px 1px 1px rgba(0,0,0,0.5)',
        ...style,
      }}
    >
      Block {block.id}
    </div>
  );
};

const _BattleshipGrid: React.FC<GridProps> = ({
  title,
  size,
  ships,
  missiles,
  onCellClick,
  showPlayerShips = false,
  playerNumber = 1,
  blocks = [],
}) => {
  const getCellContent = (x: number, y: number) => {
    const ship = ships.find(
      (s) => s.x === x && s.y === y && (showPlayerShips ? s.player === playerNumber : true)
    );
    const missile = missiles.find((m) => m.x === x && m.y === y);

    if (missile && ship) return '💥'; // Hit
    if (missile) return '💨'; // Miss
    if (ship && showPlayerShips) return '🚢'; // Ship (only show on own grid)
    return '';
  };

  const getCellClass = (x: number, y: number) => {
    const ship = ships.find(
      (s) => s.x === x && s.y === y && (showPlayerShips ? s.player === playerNumber : true)
    );
    const missile = missiles.find((m) => m.x === x && m.y === y);

    if (missile && ship) return 'cell hit';
    if (missile) return 'cell miss';
    if (ship && showPlayerShips) return 'cell ship';
    return 'cell';
  };

  return (
    <div className="battleship-grid">
      <h3>{title}</h3>
      <div
        className="relative grid gap-px bg-gray-300 p-[5px]"
        style={{
          gridTemplateColumns: `repeat(${size}, 40px)`,
        }}
      >
        {Array.from({ length: size * size }, (_, i) => {
          const x = i % size;
          const y = Math.floor(i / size);
          return (
            <button
              key={`${x}-${y}`}
              type="button"
              className={`w-10 h-10 bg-white border border-gray-600 flex items-center justify-center text-xl ${
                onCellClick ? 'cursor-pointer' : 'cursor-default'
              } ${
                getCellClass(x, y) === 'cell hit'
                  ? 'bg-red-500'
                  : getCellClass(x, y) === 'cell miss'
                    ? 'bg-blue-300'
                    : getCellClass(x, y) === 'cell ship'
                      ? 'bg-green-400'
                      : ''
              }`}
              onClick={() => onCellClick?.(x, y)}
              disabled={!onCellClick}
            >
              {getCellContent(x, y)}
            </button>
          );
        })}

        {blocks.map((block) => (
          <DraggableBlock key={block.id} block={block} gridSize={size} />
        ))}
      </div>
    </div>
  );
};

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
  const { store } = useStore();
  // const uiState = store.useQuery(uiState$);

  const [{ currentGameId, currentPlayer, opponent, myShips }, setState] = useClientDocument(
    tables.uiState
  );
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
