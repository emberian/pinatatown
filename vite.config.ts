import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.BASE_URL || './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 3000,
    open: true,
  },
});
