import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// `@/...` resolves to `src/...`. Dev server proxies /api to the NestJS backend
// so the SPA and API share an origin in development.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // @genuine-homes/shared is a workspace package compiled to CommonJS. Its real
  // path is outside node_modules (a symlink), so the commonjs plugin skips it
  // by default — include it explicitly so Rollup sees its named exports.
  optimizeDeps: { include: ['@genuine-homes/shared'] },
  build: {
    commonjsOptions: { include: [/node_modules/, /packages[/\\]shared/] },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3100',
        changeOrigin: true,
      },
    },
  },
});
