import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  // Local development: /api (manifest, icons, logos) is forwarded to `php artisan serve`,
  // so the same relative URLs work as on Vercel.
  server: {
    proxy: {
      '/api': { target: loadEnv(mode, process.cwd(), '').VITE_API_URL || 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.png', 'icons/apple-touch-icon.png'],
      // The manifest is NOT built here: each company gets its own from the API
      // (/api/companies/<slug>/manifest.webmanifest), linked from index.html / src/lib/branding.js.
      manifest: false,
      workbox: {
        // Phone notifications for jar reminders (public/push-sw.js).
        importScripts: ['push-sw.js'],
        navigateFallback: '/index.html',
        // /api and /up belong to the Laravel service; never answer them with the app shell.
        navigateFallbackDenylist: [/^\/api\//, /^\/up$/],
        globPatterns: ['**/*.{js,css,html,png,jpg,svg,woff2}'],
        // The full-size logo source is not needed offline.
        globIgnores: ['**/EasyJar Water Delivery Logo.png'],
        runtimeCaching: [
          {
            // Last-seen API data is shown when offline. Writes (POST/PUT/DELETE) are never cached;
            // offline saves go through the app's outbox (src/lib/outbox.js).
            urlPattern: ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 3600 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
}));
