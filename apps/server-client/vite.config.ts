import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'node23',
    lib: {
      entry: 'index.ts',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        // Node.js built-ins
        'process',
        'path',
        'fs',
        'url',
        'crypto',
        'events',
        'stream',
        'util',
        'buffer',
        'os',
        // External dependencies that should not be bundled
        '@livestore/adapter-node',
        '@livestore/livestore',
        '@livestore/sync-cf',
        'effect',
      ],
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@battleship/schema': '@battleship/schema',
    },
  },
  optimizeDeps: {
    // Ensure TypeScript dependencies are processed
    include: ['@battleship/schema'],
  },
});
