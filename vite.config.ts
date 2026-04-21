/// <reference types="vitest" />
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * PWA config — Sprint 7.A
 *
 * - `registerType: 'prompt'` : nouvelle version installée en arrière-plan,
 *   l'utilisateur est notifié via un toast (branché en 7.A.3) et choisit de
 *   recharger. On évite `autoUpdate` pour ne pas couper un user en plein
 *   saisie de prono.
 * - `includeAssets` : assets qui doivent être précachés mais ne sont pas
 *   référencés dans le bundle JS/CSS (favicon, apple-touch-icon).
 * - `manifest` : theme_color / background_color alignés sur `#2563eb`
 *   (primary indigo du thème). `display: standalone` pour le mode "app
 *   installée" sans chrome navigateur.
 * - `workbox.runtimeCaching` : configuration avancée ajoutée en 7.A.2.
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'icon-192.png',
        'icon-512.png',
        'icon-maskable-512.png',
      ],
      manifest: {
        name: 'PronosticsContest',
        short_name: 'Pronostics',
        description:
          'Concours de pronostics sportifs — prédisez, affrontez vos amis, grimpez au classement en direct.',
        theme_color: '#2563eb',
        background_color: '#0b1220',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'fr',
        categories: ['sports', 'social', 'entertainment'],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/auth/, /^\/rest/],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // Désactivé en dev : le SW complique le hot-reload et n'apporte rien
        // tant qu'on n'a pas testé offline.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
