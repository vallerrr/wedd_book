import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// The guest bundle has to load over congested mainland-China mobile networks,
// so the budget is deliberately tight and the admin panel is split out.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'brand/**/*', 'program/**/*'],
      manifest: {
        name: '婚礼小册 Wedd Book',
        short_name: 'Wedd Book',
        description: '三天贵州行程 · 拍立得 · 宾果 / Three days in Guizhou',
        lang: 'zh-CN',
        start_url: '/',
        display: 'standalone',
        background_color: '#faf9f7',
        theme_color: '#faf9f7',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Programme images are bundled, not fetched from Supabase, so they can be
        // precached outright — the itinerary must work with no signal.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // Programme + settings reads: serve instantly from cache, refresh behind.
            urlPattern: /\/rest\/v1\/(program_days|program_items|content_blocks|app_settings)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'programme-data',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        // Split the two big vendor groups so a code change doesn't invalidate
        // them — repeat visits over a slow network re-download almost nothing.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'react'
          }
          if (id.includes('@supabase')) return 'supabase'
        },
      },
    },
  },
})
