import type { Ship } from './SeaObject';

interface MissileResult {
  x: number;
  y: number;
  isHit: boolean;
}

/**
 * Calculates all ship positions for a given ship
 * @param ship - The ship to calculate positions for
 * @returns Array of {x, y} coordinates the ship occupies
 */
export const getShipPositions = (ship: Ship): Array<{ x: number; y: number }> => {
  const positions: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < ship.length; i++) {
    if (ship.orientation === 0) {
      // Horizontal ship
      positions.push({ x: ship.x + i, y: ship.y });
    } else {
      // Vertical ship (90 degrees)
      positions.push({ x: ship.x, y: ship.y + i });
    }
  }

  return positions;
};

/**
 * Checks if all positions of all ships have been hit by missiles
 * @param ships - Array of ships to check
 * @param missileResults - Array of missile results with hit information
 * @returns true if all ship positions have been hit, false otherwise
 */
export const areAllShipsSunk = (ships: Ship[], missileResults: MissileResult[]): boolean => {
  if (ships.length === 0) return false;

  // Get all ship positions
  const allShipPositions = ships.flatMap((ship) => getShipPositions(ship));

  // Get all hit positions
  const hitPositions = missileResults
    .filter((result) => result.isHit)
    .map((result) => `${result.x},${result.y}`);

  const hitPositionSet = new Set(hitPositions);

  // Check if every ship position has been hit
  return allShipPositions.every((pos) => hitPositionSet.has(`${pos.x},${pos.y}`));
};
