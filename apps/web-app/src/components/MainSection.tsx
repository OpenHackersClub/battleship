import { useDragDropMonitor, useDraggable } from '@dnd-kit/react';
import { queryDb } from '@livestore/livestore';
import { useStore } from '@livestore/react';
import type React from 'react';
import { useState } from 'react';

import { uiState$ } from '../livestore/queries.js';
import { events, tables } from '../livestore/schema.js';
import { MySeaGrid } from './MySeaGrid.js';
import { OpponentSeaGrid } from './OpponentSeaGrid.js';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Separator } from './ui/separator';

const allShips$ = queryDb(tables.allShips.select(), { label: 'allShips' });
const missiles$ = queryDb(tables.missles.select(), { label: 'missiles' });

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
  const uiState = store.useQuery(uiState$);
  const _allShips = store.useQuery(allShips$);
  const _missiles = store.useQuery(missiles$);

  console.log('MainSection render - uiState:', uiState);
  console.log('MainSection render - myShips:', uiState?.myShips?.length);

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

  // Initialize 5 blocks with length 3
  const [blocks, setBlocks] = useState<Block[]>([
    { id: '1', x: 0, y: 0, width: 3, height: 1, color: '#ff6b6b' },
    { id: '2', x: 0, y: 1, width: 3, height: 1, color: '#4ecdc4' },
    { id: '3', x: 0, y: 2, width: 3, height: 1, color: '#45b7d1' },
    { id: '4', x: 0, y: 3, width: 3, height: 1, color: '#f9ca24' },
    { id: '5', x: 0, y: 4, width: 3, height: 1, color: '#6c5ce7' },
  ]);

  const [_activeId, setActiveId] = useState<string | null>(null);

  const _handlePlayerGridClick = (x: number, y: number) => {
    // Handle ship placement on player's own grid
    console.log(`Player grid clicked at ${x}, ${y}`);
  };

  const _handleOpponentGridClick = (x: number, y: number) => {
    // Handle missile firing on opponent's grid
    console.log(`Firing missile at ${x}, ${y}`);
    const missileId = `missile-${Date.now()}-${Math.random()}`;
    store.commit(events.MissleFired({ id: missileId, player: 'player1', x, y }));
  };

  const _handleDragStart = (event: { source: { id: string } }) => {
    setActiveId(event.source.id);
  };

  const _handleDragEnd = (event: {
    canceled?: boolean;
    source: { id: string };
    operation: { transform: { x: number; y: number } };
  }) => {
    if (event.canceled) return;

    const draggedId = event.source.id;
    const { x: transformX, y: transformY } = event.operation.transform;

    if (transformX !== 0 || transformY !== 0) {
      const activeBlock = blocks.find((b) => b.id === draggedId);
      if (activeBlock) {
        const cellSize = 41; // 40px cell + 1px gap
        const padding = 5;

        // Calculate the new position based on the transform
        const currentPixelX = activeBlock.x * cellSize + padding;
        const currentPixelY = activeBlock.y * cellSize + padding;
        const newPixelX = currentPixelX + transformX;
        const newPixelY = currentPixelY + transformY;

        // Convert back to grid coordinates and snap
        const newGridX = Math.round((newPixelX - padding) / cellSize);
        const newGridY = Math.round((newPixelY - padding) / cellSize);

        // Apply bounds checking
        const gridSize = 10; // fixed for now
        const maxX = Math.max(0, gridSize - activeBlock.width);
        const maxY = Math.max(0, gridSize - activeBlock.height);

        const snappedX = Math.max(0, Math.min(maxX, newGridX));
        const snappedY = Math.max(0, Math.min(maxY, newGridY));

        setBlocks((blocks) =>
          blocks.map((block) =>
            block.id === draggedId ? { ...block, x: snappedX, y: snappedY } : block
          )
        );
      }
    }

    setActiveId(null);
  };

  return (
    <section className="main">
      <div className="flex gap-8 justify-center items-start p-8 w-full max-w-6xl mx-auto">
        <div className="flex-1">
          <MySeaGrid player="player1" />
          <PlayerTitle playerName="Player 1 (You)" />
        </div>
        <Separator orientation="vertical" className="h-96 w-px bg-gray-400" />
        <div className="flex-1">
          <OpponentSeaGrid player="player2" />
          <PlayerTitle playerName="Player 2" />
        </div>
      </div>
    </section>
  );
};
