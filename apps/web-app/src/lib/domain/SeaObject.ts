// Using Tailwind CSS default color classes
export const shipColorClasses = [
  'bg-red-500 border-red-600', // Vibrant red
  'bg-teal-500 border-teal-600', // Modern teal
  'bg-orange-500 border-blue-600', //
  'bg-amber-400 border-amber-500', // Bright amber
  'bg-violet-400 border-violet-500', // Rich violet
];

export type SeaObject = {
  id: string;
  x: number; // grid column position (0-based)
  y: number; // grid row position (0-based)
  length: number; // number of cells along orientation (1-5)
  orientation: 0 | 90;
};

// currently length can only be 1, although we could do bombs of various shapes
export type Missle = SeaObject & {
  firedBy: string;
  length: 1;
  orientation: 0;
};

export type Ship = SeaObject & {
  colorClass: string; // Tailwind color class
};

export const getPositions = (seaObject: SeaObject) => {
  return Array.from({ length: seaObject.length }, (_, i) =>
    seaObject.orientation === 0
      ? { x: seaObject.x + i, y: seaObject.y }
      : { x: seaObject.x, y: seaObject.y + i }
  );
};
