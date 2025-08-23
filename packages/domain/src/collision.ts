import { getPositions, type SeaObject } from './SeaObject';

// TODO implement a popular mechanics where ships need to be 1 block away from each other
// one way to do it is use a expanded ship object so we can still just find the virtual intersection

// we simplify to find any overlapping coordinate and don't use the @dnd-kit/collision which is drag operation & view position based
/**
 *
 * Unencrypted variant
 *
 * @param thisPositions
 * @param allPositions
 * @returns
 */

export const isColliding = (thisSeaObject: SeaObject, allSeaObjects: SeaObject[]) => {
  const thisPositions = getPositions(thisSeaObject);
  const thisKeys = new Set(thisPositions.map(encodeCoordinates));

  const otherKeys = new Set(
    allSeaObjects
      .filter((seaObject) => thisSeaObject.id !== seaObject.id)
      .flatMap(getPositions)
      .map(encodeCoordinates)
  );

  const idx = [...thisKeys].findIndex((key) => otherKeys.has(key));

  return thisPositions?.[idx];
};

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