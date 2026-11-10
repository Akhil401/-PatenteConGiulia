import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Static build for Cloudflare Pages (output: dist/). Installable + offline via a service worker.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Patente con Giulia',
        short_name: 'Patente',
        description: 'Learn the Italian Patente B theory exam with Giulia, your animated teacher.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0d17',
        theme_color: '#4f46e5',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // app shell is precached; chapters, dictionaries and images are cached the first time they are used
        globPatterns: ['**/*.{js,css,html,svg,woff2}', 'data/index.json', 'data/ready.json', 'data/glossary.json', 'data/intros.json', 'icons/*.png'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          { urlPattern: /\/data\/.*\.json$/, handler: 'NetworkFirst', options: { cacheName: 'data', networkTimeoutSeconds: 3 } },
          { urlPattern: /\/images\/.*$/, handler: 'CacheFirst', options: { cacheName: 'images', expiration: { maxEntries: 600 } } },
        ],
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 1500 },
})
