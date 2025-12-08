import { getShipPositions, type MissileResult, type Ship } from '@battleship/domain';
import { SHIP_COLOR_CLASSES } from './SeaGrid';

interface ShipDisplayProps {
  ships: Ship[];
  title?: string;
  missileResults?: MissileResult[];
}

const isShipSunk = (ship: Ship, missileResults: MissileResult[]): boolean => {
  if (!missileResults || missileResults.length === 0) return false;
  const hitPositions = new Set(missileResults.map((result) => `${result.x},${result.y}`));
  const shipPositions = getShipPositions(ship);
  return shipPositions.every((pos) => hitPositions.has(`${pos.x},${pos.y}`));
};

export const ShipDisplay: React.FC<ShipDisplayProps> = ({ ships, title, missileResults = [] }) => {
  if (ships.length === 0) return null;

  return (
    <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
      {title && <h3 className="text-sm font-semibold mb-3 text-gray-700">{title}</h3>}
      <div className="space-y-2">
        {ships.map((ship, idx) => {
          const colorClass = SHIP_COLOR_CLASSES[idx % SHIP_COLOR_CLASSES.length];
          const sunk = isShipSunk(ship, missileResults);

          return (
            <div key={ship.id} className={`flex items-center gap-3 ${sunk ? 'opacity-50' : ''}`}>
              {/* Ship visual representation */}
              <div className={`flex ${ship.orientation === 90 ? 'flex-col' : 'flex-row'}`}>
                {Array.from({ length: ship.length }, (_, blockIdx) => (
                  <div
                    key={`${ship.id}-${blockIdx}`}
                    className={`w-4 h-4 border-2 ${colorClass} ${
                      blockIdx === 0 && ship.length > 1
                        ? ship.orientation === 0
                          ? 'rounded-l'
                          : 'rounded-t'
                        : blockIdx === ship.length - 1 && ship.length > 1
                          ? ship.orientation === 0
                            ? 'rounded-r'
                            : 'rounded-b'
                          : ship.length === 1
                            ? 'rounded'
                            : ''
                    } ${ship.orientation === 90 ? 'mb-0.5' : 'mr-0.5'}`}
                  />
                ))}
              </div>

              {/* Ship info */}
              <div className="text-xs text-gray-600">
                Length: {ship.length} • {ship.orientation === 0 ? 'Horizontal' : 'Vertical'}
              </div>

              {/* Sunk indicator */}
              {sunk && <span className="text-red-600 font-bold">✗</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};
