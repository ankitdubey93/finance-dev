import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The SPA has ONE origin. In dev, Vite proxies /api → platform-api so the
// browser never calls a tool service directly.
const PLATFORM_API_URL = process.env.PLATFORM_API_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: {
      '/api': { target: PLATFORM_API_URL, changeOrigin: true },
    },
  },
});
