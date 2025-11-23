import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Simple Vite config for the React app
export default defineConfig({
  plugins: [react()],
  // GitHub Pages 配信用にサブパスを指定（リポジトリ名と合わせる）
  base: '/ArcRaiders/',
  server: {
    port: 5173,
  },
});
