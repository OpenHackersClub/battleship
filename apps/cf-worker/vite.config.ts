import { defineConfig } from 'vite'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [...cloudflare()],
  build: {
    lib: {
      entry: './src/sync-worker.ts',
      name: 'cf-worker',
      fileName: 'index',
      formats: ['es']
    },
    rollupOptions: {
      external: [],
    },
    outDir: 'dist',
    emptyOutDir: true
  }
})