import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base` is relative so the static build works from GitHub Pages sub-paths.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173 },
});
