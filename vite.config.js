import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Simple Vite config for the React app
// base は環境変数 BASE_PATH を優先し、未指定なら相対パスにしてローカル/Pages両方対応
const base = process.env.BASE_PATH || './';

export default defineConfig({
  plugins: [react()],
  base,
  server: {
    port: 5173,
  },
  build: {
    sourcemap: true,
  },
});
