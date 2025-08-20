import type { Ship } from '@/components/Ship';

// we simplify to find any overlapping coordinate and don't use the @dnd-kit/collision which is drag operation & view position based

/**
 *
 * Unencrypted variant
 *
 * @param thisShip
 * @param allShips
 * @returns
 */

export const isShipColliding = (thisShip: Ship, allShips: Ship[]) => {
  const thisKeys = new Set(getShipPositions(thisShip).map(encodeCoordinates));

  const otherKeys = new Set(
    allShips
      .filter((ship) => ship.id !== thisShip.id)
      .flatMap(getShipPositions)
      .map(encodeCoordinates)
  );

  return [...thisKeys].some((key) => otherKeys.has(key));
};

// Helper function to get all grid positions occupied by a ship
const getShipPositions = (ship: Ship): Array<{ x: number; y: number }> =>
  Array.from({ length: ship.length }, (_, i) =>
    ship.orientation === 0 ? { x: ship.x + i, y: ship.y } : { x: ship.x, y: ship.y + i }
  );

// Encode coordinates as a single integer using bit-packing: key = (x << B) | y
const COORD_BIT_WIDTH = 8;
const encodeCoordinates = (pos: { x: number; y: number }): number =>
  (pos.x << COORD_BIT_WIDTH) | pos.y;

/**
 *
 * Encrypted variant to find intereseciton deterministically
 * Private Set Intersection (PSI) via Homormorphic encryption is sufficient as we're ok to reveal the intersection
 *
 */
