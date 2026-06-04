import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/te-araroa-prep/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Te Araroa Prep',
        short_name: 'TA Prep',
        description: 'Personal Te Araroa thru-hike prep & tracker',
        theme_color: '#B5651D',
        background_color: '#F4EFE6',
        display: 'standalone',
        start_url: '/te-araroa-prep/',
        scope: '/te-araroa-prep/',
        icons: [
          {
            src: '/te-araroa-prep/ta-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/te-araroa-prep/ta-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/te-araroa-prep/ta-icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
})
