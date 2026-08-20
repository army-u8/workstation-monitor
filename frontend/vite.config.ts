import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';

const backendPort = process.env.BACKEND_PORT || process.env.VITE_BACKEND_PORT || '9527';

export default defineConfig({
  plugins: [tailwindcss(), solid()],
  server: {
    port: 9529,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${backendPort}`,
        changeOrigin: true,
      },
      '/ws': {
        target: `ws://127.0.0.1:${backendPort}`,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
