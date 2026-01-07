import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Safely polyfill process.env for the browser bundle
    'process.env': {
      API_KEY: JSON.stringify(process.env.API_KEY),
      SUPABASE_URL: JSON.stringify(process.env.SUPABASE_URL),
      SUPABASE_ANON_KEY: JSON.stringify(process.env.SUPABASE_ANON_KEY),
      NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development')
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
  }
});