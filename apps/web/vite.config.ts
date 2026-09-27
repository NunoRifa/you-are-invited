import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { invitationRoutePlugin } from './vite-plugin-invitation';

export default defineConfig({
  plugins: [react(), invitationRoutePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
