import { useClientDocument, useStore } from '@livestore/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { isColliding } from '@/lib/domain/collision';
import { allMissiles$, opponentShips$ } from '../livestore/queries';
import { events, tables } from '../livestore/schema';
import { useGameState } from './GameStateProvider';
import { type CellPixelSize, SeaGrid } from './SeaGrid';

type Cell = { x: number; y: number };

interface MissileCrossProps {
  id: string;
  left: number;
  top: number;
  size?: number;
  thickness?: number;
  color?: string;
}

const MissileCross: React.FC<MissileCrossProps> = ({
  id,
  left,
  top,
  size = 14,
  thickness = 2,
  color = '#991b1b',
}) => (
  <div key={`missile-cross-${id}`} className="absolute z-10 pointer-events-none">
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: size,
        height: thickness,
        backgroundColor: color,
        transform: 'rotate(45deg)',
        transformOrigin: 'center',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: size,
        height: thickness,
        backgroundColor: color,
        transform: 'rotate(-45deg)',
        transformOrigin: 'center',
      }}
    />
  </div>
);

export const OpponentSeaGrid = ({ player }: { player: string }) => {
  const [hoverCell, setHoverCell] = useState<Cell | null>(null);
  const { store } = useStore();

  const { currentGameId } = useGameState();

  const [{ opponent }] = useClientDocument(tables.uiState);

  const missiles$ = useMemo(() => allMissiles$(currentGameId ?? ''), [currentGameId]);
  const opponentShipsQuery$ = useMemo(
    () => opponentShips$(currentGameId ?? '', opponent),
    [currentGameId, opponent]
  );

  const missiles = store.useQuery(missiles$);
  const opponentShips = store.useQuery(opponentShipsQuery$);

  useEffect(() => {
    // debug
    console.table(opponentShips);
  }, [opponentShips]);

  const computeCellFromEvent = useCallback(
    (
      e: React.MouseEvent<Element>,
      gridElement: HTMLDivElement | null,
      cellPixelSize: CellPixelSize,
      cols = 10,
      rows = 10
    ): Cell | null => {
      if (!gridElement) return null;
      const rect = gridElement.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      const stepX = cellPixelSize.width + cellPixelSize.gapX;
      const stepY = cellPixelSize.height + cellPixelSize.gapY;
      if (stepX <= 0 || stepY <= 0) return null;
      const x = Math.max(0, Math.min(cols - 1, Math.floor(offsetX / stepX)));
      const y = Math.max(0, Math.min(rows - 1, Math.floor(offsetY / stepY)));
      return { x, y };
    },
    []
  );

  return (
    <>
      <SeaGrid player={player}>
        {({ cellPixelSize, gridRef }) => {
          const handleMouseMove = (e: React.MouseEvent) => {
            const cell = computeCellFromEvent(e, gridRef.current, cellPixelSize);
            setHoverCell(cell);
          };

          const handleMouseLeave = () => setHoverCell(null);

          const handleClick = (e: React.MouseEvent) => {
            const cell = computeCellFromEvent(e, gridRef.current, cellPixelSize);
            if (cell) {
              console.log('fire atttempt', cell.x, cell.y);
              const alreadyFired = missiles.find((m) => m.x === cell.x && m.y === cell.y);
              if (!alreadyFired) {
                const missileId = `missile-${Date.now()}-${Math.random()}`;
                store.commit(
                  events.MissleFired({
                    id: missileId,
                    gameId: currentGameId,
                    player,
                    x: cell.x,
                    y: cell.y,
                  })
                );
              }
            }
          };

          const left = hoverCell ? hoverCell.x * (cellPixelSize.width + cellPixelSize.gapX) : 0;
          const top = hoverCell ? hoverCell.y * (cellPixelSize.height + cellPixelSize.gapY) : 0;
          const width = cellPixelSize.width;
          const height = cellPixelSize.height;

          return (
            <>
              <button
                type="button"
                className="absolute inset-0 z-20"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    // simulate click via keyboard
                    handleClick(e as unknown as React.MouseEvent);
                  }
                }}
                aria-label="opponent grid overlay"
              />
              {(missiles ?? []).map((m) => {
                // Check if missile collides with any opponent ship
                const missileAsSeaObject = {
                  id: m.id,
                  x: m.x,
                  y: m.y,
                  length: 1,
                  orientation: 0 as const,
                  player: m.player,
                };
                const collisionPoint = isColliding(missileAsSeaObject, [...(opponentShips ?? [])]);
                const isHit = !!collisionPoint;

                if (isHit) {
                  const size = 14;
                  const thickness = 2;
                  const leftCross =
                    m.x * (cellPixelSize.width + cellPixelSize.gapX) +
                    (cellPixelSize.width - size) / 2;
                  const topCross =
                    m.y * (cellPixelSize.height + cellPixelSize.gapY) +
                    (cellPixelSize.height - thickness) / 2;
                  return (
                    <MissileCross
                      key={`missile-cross-${m.id}`}
                      id={m.id}
                      left={leftCross}
                      top={topCross}
                      size={size}
                      thickness={thickness}
                    />
                  );
                }
                const dotSize = 10;
                const mLeft =
                  m.x * (cellPixelSize.width + cellPixelSize.gapX) +
                  (cellPixelSize.width - dotSize) / 2;
                const mTop =
                  m.y * (cellPixelSize.height + cellPixelSize.gapY) +
                  (cellPixelSize.height - dotSize) / 2;
                return (
                  <div
                    key={`missile-dot-${m.id}`}
                    className="absolute z-10 pointer-events-none"
                    style={{
                      left: mLeft,
                      top: mTop,
                      width: dotSize,
                      height: dotSize,
                      borderRadius: '9999px',
                      backgroundColor: '#1e3a8a',
                      boxShadow: '0 0 0 1px rgba(0,0,0,0.2)',
                    }}
                  />
                );
              })}
              {hoverCell && (
                <div
                  className="absolute z-10 bg-blue-400/40 border border-blue-500 pointer-events-none"
                  style={{ left, top, width, height }}
                />
              )}
            </>
          );
        }}
      </SeaGrid>
      <div className="mt-2" />
    </>
  );
};

export default OpponentSeaGrid;
