import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    cloudflare({
      entrypoint: 'index.ts',
    }),
  ],
  build: {
    rollupOptions: {
      external: [],
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
