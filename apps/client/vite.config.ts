import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base` is relative so the static build works from GitHub Pages sub-paths.
export default defineConfig({
  base: './',
  plugins: [react()],
  // The standalone build inlines fonts so the game is a single file.
  build: process.env.PM_INLINE_ASSETS ? { assetsInlineLimit: 1e8, cssCodeSplit: false, modulePreload: false } : undefined,
  server: { port: 5173 },
});
