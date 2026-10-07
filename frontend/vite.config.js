import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'साई वॉटर सप्लायर्स – जार व्यवस्थापन',
        short_name: 'साई वॉटर',
        description: 'साई वॉटर सप्लायर्स, कोळेवाडी – दैनंदिन जार वाटप, परत आलेले जार, उधारी आणि पेमेंट.',
        lang: 'mr-IN',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#1e3a8a',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Phone notifications for jar reminders (public/push-sw.js).
        importScripts: ['push-sw.js'],
        navigateFallback: '/index.html',
        // /api and /up belong to the Laravel service; never answer them with the app shell.
        navigateFallbackDenylist: [/^\/api\//, /^\/up$/],
        globPatterns: ['**/*.{js,css,html,png,jpg,svg,woff2}'],
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
});
