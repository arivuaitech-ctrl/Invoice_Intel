import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // This allows the browser to access process.env.API_KEY and others
    // even though 'process' doesn't natively exist in the browser.
    'process.env': process.env,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  }
});