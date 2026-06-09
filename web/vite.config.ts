import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      usePolling: true,
      interval: 300,
      ignored: ['**/dist/**', '**/.wrangler/**', '**/seo/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: true,

    // Increase chunk size warning limit (in KB)
    chunkSizeWarningLimit: 1000,

    // Enable code splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          // Vendor chunks for better caching
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/react-router')) {
            return 'vendor-router';
          }
          if (id.includes('node_modules/lucide-react') || id.includes('node_modules/recharts')) {
            return 'vendor-ui';
          }
          if (id.includes('node_modules/axios')) {
            return 'vendor-http';
          }
        },
      },
    },
  },
});
