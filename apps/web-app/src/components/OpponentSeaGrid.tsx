import { queryDb } from '@livestore/livestore';
import { useStore } from '@livestore/react';
import { useCallback, useState } from 'react';
import { events, tables } from '../livestore/schema.js';
import { type CellPixelSize, SeaGrid } from './SeaGrid.js';

type Cell = { x: number; y: number };

export const OpponentSeaGrid = ({ player }: { player: string }) => {
  const [hoverCell, setHoverCell] = useState<Cell | null>(null);
  const { store } = useStore();
  const missiles$ = queryDb(tables.missles.select(), { label: 'missiles-opponent' });
  const missiles = store.useQuery(missiles$);

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
              const alreadyFired = (missiles ?? []).some((m) => m.x === cell.x && m.y === cell.y);
              if (!alreadyFired) {
                const missileId = `missile-${Date.now()}-${Math.random()}`;
                store.commit(events.MissleFired({ id: missileId, player, x: cell.x, y: cell.y }));
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
      <div className="mt-2 flex justify-center items-center">
        Fired:
        <span className="px-2.5 py-0.5 rounded-full bg-gray-800 text-white text-xs font-medium m-2">
          {missiles?.length ?? 0}
        </span>
      </div>
    </>
  );
};

export default OpponentSeaGrid;
