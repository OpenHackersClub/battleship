export type SeaObject = {
  id: string;
  x: number; // grid column position (0-based)
  y: number; // grid row position (0-based)
  length: number; // number of cells along orientation (1-5)
  player: string;
  orientation: 0 | 90;
};

// currently length can only be 1, although we could do bombs of various shapes
export type Missle = SeaObject & {
  length: 1;
  orientation: 0;
};

export type Ship = SeaObject & {};

export const getPositions = (seaObject: SeaObject) => {
  return Array.from({ length: seaObject.length }, (_, i) =>
    seaObject.orientation === 0
      ? { x: seaObject.x + i, y: seaObject.y }
      : { x: seaObject.x, y: seaObject.y + i }
  );
};
