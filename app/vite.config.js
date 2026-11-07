import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Client lives in client/, builds into dist/, which Express serves.
// In development, `npm run dev` runs this server and proxies /api to Express on :3000.
export default defineConfig({
  root: 'client',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true
  },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false } }
  }
});
