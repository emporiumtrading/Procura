import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      // API keys must NOT be bundled into client-side code.
      // Use VITE_* prefixed env vars for public config only (e.g. Supabase URL).
      define: {},
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom', 'react-router-dom'],
              supabase: ['@supabase/supabase-js'],
              icons: ['lucide-react'],
            },
          },
        },
      },
    };
});
