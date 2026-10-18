import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: r('./src/client'),
  publicDir: r('./public'),
  base: '/',
  resolve: {
    alias: { '@shared': r('./src/shared') },
  },
  build: {
    outDir: r('./dist/public'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    assetsInlineLimit: 0,
  },
  server: {
    port: 5173,
    proxy: { '/api/': 'http://127.0.0.1:3000' },
  },
});
