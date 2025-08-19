// Using Tailwind CSS default color classes
export const shipColorClasses = [
  'bg-red-500 border-red-600', // Vibrant red
  'bg-teal-500 border-teal-600', // Modern teal
  'bg-orange-500 border-blue-600', //
  'bg-amber-400 border-amber-500', // Bright amber
  'bg-violet-400 border-violet-500', // Rich violet
];

export type Ship = {
  id: string;
  x: number; // grid column position (0-based)
  y: number; // grid row position (0-based)
  colorClass: string; // Tailwind color class
  length: number; // number of cells along orientation (1-5)
  orientation: 0 | 90;
};
