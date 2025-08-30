import type { Ship } from '@battleship/domain';
import { SHIP_COLOR_CLASSES } from './SeaGrid';

interface ShipDisplayProps {
  ships: Ship[];
  title?: string;
}

export const ShipDisplay: React.FC<ShipDisplayProps> = ({ ships, title }) => {
  if (ships.length === 0) return null;

  return (
    <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
      {title && <h3 className="text-sm font-semibold mb-3 text-gray-700">{title}</h3>}
      <div className="space-y-2">
        {ships.map((ship, idx) => {
          const colorClass = SHIP_COLOR_CLASSES[idx % SHIP_COLOR_CLASSES.length];

          return (
            <div key={ship.id} className="flex items-center gap-3">
              {/* Ship visual representation */}
              <div className={`flex ${ship.orientation === 90 ? 'flex-col' : 'flex-row'}`}>
                {Array.from({ length: ship.length }, (_, blockIdx) => (
                  <div
                    key={ship.id}
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
            </div>
          );
        })}
      </div>
    </div>
  );
};
