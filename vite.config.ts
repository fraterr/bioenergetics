import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `base: './'` emits relative asset URLs so the build works on any GitHub Pages
// sub-path (https://<user>.github.io/<repo>/) without hard-coding the repo name.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'recharts'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
