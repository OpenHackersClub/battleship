import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [...cloudflare()],
  build: {
    lib: {
      entry: './src/sync-worker.ts',
      name: 'cf-worker',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      external: [],
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
