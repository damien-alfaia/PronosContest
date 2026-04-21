/// <reference types="vitest" />
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type PluginOption } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Bundle analyzer — Sprint 7.B.1
 *
 * Activé via `pnpm build:analyze` (variable `ANALYZE=true`). Génère un fichier
 * `dist/stats.html` interactif (treemap) qui permet de vérifier que le
 * code-splitting joue bien son rôle :
 *   - chaque page `/app/*` et `/auth/*` doit apparaître dans son propre chunk
 *   - les libs partagées (react, react-router, zod, lucide, …) restent dans
 *     un vendor commun
 *   - repérer les dépendances inattendues qui gonflent l'entry bundle
 *
 * Le plugin n'est PAS chargé en build normal (CI, Vercel) pour ne pas
 * ralentir la pipeline ni polluer `dist/` avec un stats.html non désiré.
 */
const shouldAnalyze = process.env.ANALYZE === 'true';

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
      // On enregistre le SW via `useRegisterSW()` dans `<UpdatePrompt />`
      // (hook React), pas besoin que Vite injecte un second script. Éviter
      // `'auto'` ici ou on enregistrerait le SW deux fois.
      injectRegister: false,
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
        // `skipWaiting: false` : on attend la décision user via
        // `useRegisterSW().updateServiceWorker()` (toast "Recharger",
        // branché en 7.A.3). Sinon le SW swap immédiatement → perte de
        // state React en plein formulaire.
        skipWaiting: false,
        clientsClaim: false,
        runtimeCaching: [
          // --- Supabase REST (read queries, views) -----------------------
          // NetworkFirst avec timeout court : on veut la vérité serveur
          // quand on est online (classement live, pronos ouverts…), mais
          // on accepte un fallback cache si le réseau flanche.
          // ⚠️ On n'applique PAS ça aux requêtes d'écriture (POST/PATCH/
          // DELETE) — Workbox ne cache de toute façon que les GET.
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              /\.supabase\.co$/i.test(url.hostname) &&
              /^\/rest\/v1\//.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-rest',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 h
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // --- Supabase Storage (avatars, drapeaux, médias) --------------
          // CacheFirst : ces ressources changent rarement et sont lourdes.
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              /\.supabase\.co$/i.test(url.hostname) &&
              /^\/storage\/v1\/object\/public\//.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 jours
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // --- Auth + Realtime : JAMAIS cachés ---------------------------
          // Workbox n'intercepte pas les WebSockets (realtime) et on laisse
          // les appels Auth/token passer en network-only par sécurité.
          {
            urlPattern: ({ url }) =>
              /\.supabase\.co$/i.test(url.hostname) &&
              (/^\/auth\/v1\//.test(url.pathname) ||
                /^\/realtime\/v1\//.test(url.pathname)),
            handler: 'NetworkOnly',
          },
          // --- Drapeaux Wikipedia Commons (fallback si pas en Storage) ---
          {
            urlPattern: /^https:\/\/upload\.wikimedia\.org\/.*\.(png|svg|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'external-flags',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 jours
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Désactivé en dev : le SW complique le hot-reload et n'apporte rien
        // tant qu'on n'a pas testé offline.
        enabled: false,
      },
    }),
    // Bundle analyzer — uniquement quand `ANALYZE=true` (voir `build:analyze`).
    // Cast vers PluginOption : rollup-plugin-visualizer embarque sa propre copie
    // des types Rollup qui diverge (très marginalement) de celle bundlée par
    // Vite 5 — le cast est sûr, le plugin tourne correctement à l'exécution.
    ...(shouldAnalyze
      ? [
          visualizer({
            filename: 'dist/stats.html',
            open: true,
            gzipSize: true,
            brotliSize: true,
            template: 'treemap',
          }) as PluginOption,
        ]
      : []),
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
