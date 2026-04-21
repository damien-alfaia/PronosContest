# ADR-0003 — PWA (service worker + runtime caching + update prompt)

- **Statut** : accepté
- **Date** : 2026-04-21
- **Contexte projet** : PronosticsContest v2 — Sprint 7.A (PWA)

## Contexte

Au terme du Sprint 6, l'app est fonctionnellement complète côté métier
(auth, concours, pronos, scoring temps réel, chat, badges, notifs). Pour
lancer en v1 il reste à la rendre **installable** (icône écran d'accueil,
mode standalone) et à la **résilier aux pertes de connexion** — un usage
typique des utilisateurs est de consulter un classement ou un message chat
pendant un trajet en métro.

Trois options techniques ont été comparées :

1. Rien : app web classique, pas d'install, pas de cache offline.
2. PWA minimale : `manifest.webmanifest` + service worker custom.
3. PWA via `vite-plugin-pwa` : manifest + Workbox + hook React officiel.

## Décision

Adopter `vite-plugin-pwa` (0.21) + `workbox-window` (7.3). Cette combinaison
donne :

- **Manifest PWA** (`manifest.webmanifest`) généré par Vite avec les
  icônes maskable 192/512 et les métadonnées (`theme_color`,
  `background_color`, `display: standalone`, `scope`, `lang: fr`).
- **Service Worker** auto-généré par Workbox avec précache des assets
  statiques (JS, CSS, HTML, SVG, PNG, WEBP, WOFF2) + runtime caching
  configurable.
- **Hook React** `useRegisterSW` (import virtuel `virtual:pwa-register/react`)
  qui expose `needRefresh`, `offlineReady`, `updateServiceWorker` —
  branché à un toast Sonner dans `<UpdatePrompt />`.
- **Custom install banner** `<InstallPrompt />` qui écoute
  `beforeinstallprompt` + `appinstalled` et propose l'installation sans
  dépendre du prompt natif du navigateur (qui ne rejoue plus après
  dismiss sur mobile).

### Stratégie de cache (Workbox runtime)

| Cible                                | Handler         | Justification                                     |
| ------------------------------------ | --------------- | ------------------------------------------------- |
| Supabase REST `/rest/v1/**` (GET)    | `NetworkFirst` 3s | Source de vérité réseau, fallback cache si offline. |
| Supabase Storage `/storage/v1/object/public/**` | `CacheFirst` 30j | Avatars + drapeaux = rarement modifiés, lourds.   |
| Supabase Auth `/auth/v1/**`          | `NetworkOnly`   | Tokens et sessions : jamais servir un cache.      |
| Supabase Realtime `/realtime/v1/**`  | `NetworkOnly`   | WebSocket, pas cacheable de toute façon.          |
| `upload.wikimedia.org/**`            | `CacheFirst` 30j | Fallback drapeaux, assets stables.                |

> Les précaches de pages (`navigateFallback: 'index.html'`) permettent à
> l'app de démarrer offline sur n'importe quelle route — React Router
> prend ensuite le relais.

### Stratégie d'update (`registerType: 'prompt'`)

- `skipWaiting: false` + `clientsClaim: false` : le nouveau SW attend
  explicitement la décision utilisateur.
- Toast `<UpdatePrompt />` avec actions **"Recharger"** (appelle
  `updateServiceWorker(true)`) et **"Plus tard"** (ferme le toast,
  `setNeedRefresh(false)` → re-propose au prochain boot).
- `duration: Infinity` sur le toast : l'utilisateur ne peut pas le
  rater par inattention.

Motif : on ne veut **jamais** forcer un reload pendant une saisie de
prono. `autoUpdate` (mode par défaut de `vite-plugin-pwa`) recharge
silencieusement à chaque build, inacceptable ici.

### Stratégie d'install (custom vs natif)

- Composant `<InstallPrompt />` écoute `beforeinstallprompt`, bloque le
  prompt natif (`event.preventDefault()`) et affiche **notre** bannière.
- Après dismiss → timestamp stocké dans `localStorage` sous la clé
  `pwa:install:dismissedAt` → pas de re-proposition avant 30 jours.
- `appinstalled` event → bannière masquée définitivement.
- Détection `display-mode: standalone` + iOS `navigator.standalone` →
  si l'app est déjà installée, la bannière ne s'affiche jamais.

### `injectRegister: false`

On désactive l'injection auto du script de registration SW par
`vite-plugin-pwa` — parce qu'on enregistre le SW exclusivement via
`useRegisterSW()` dans `<UpdatePrompt />`. Si on gardait `'auto'` on
aurait **deux** enregistrements concurrents du même SW (script inline
+ hook React), avec des effets de bord difficiles à déboguer.

## Alternatives écartées

| Alternative | Pourquoi non |
| --- | --- |
| **Service worker custom** (sans Workbox) | On réécrirait cache invalidation, stale-while-revalidate, navigate fallback à la main. Workbox, c'est 5 ans de corrections de bugs déjà faites. |
| **`registerType: 'autoUpdate'`** | Recharge silencieuse → inacceptable en plein form de prono. |
| **Popup natif `beforeinstallprompt` seul** | Ne rejoue pas après dismiss, pas personnalisable, pas visible sur iOS Safari. Notre bannière custom couvre les deux plateformes. |
| **Next.js + PWA plugin** | Changement de framework complet, trop gros pour l'apport. Vite + `vite-plugin-pwa` suffit. |
| **Pas de PWA du tout** | Bloque l'usage mobile réel (pas d'icône, pas d'offline, pas de persist). Non négociable pour un MVP mobile-first. |

## Conséquences

**Positives**
- Installation 1-tap sur Android / Chrome desktop, ajout manuel sur iOS
  (comme toutes les PWA).
- Premier paint hors ligne sur n'importe quelle route déjà visitée.
- Classement + avatars + drapeaux disponibles offline (cache 24 h / 30 j).
- L'utilisateur garde le contrôle sur les updates : jamais de reload
  forcé.
- Lighthouse PWA score → ✅ installable (cible audit 7.B.2).

**Négatives / à surveiller**
- Toute ressource référencée par un sélecteur `runtimeCaching` doit
  rester **CORS-safe** — un drapeau servi avec `Access-Control-Allow-Origin`
  manquant n'est pas cacheable (`cacheableResponse.statuses: [0, 200]`
  limite le problème mais ne l'élimine pas).
- L'utilisateur peut voir une version cachée "périmée" d'un classement
  s'il revient en ligne après 24 h — mitigé par `NetworkFirst` et la
  revalidation TanStack Query.
- Debug complexifié : un bug de prod peut venir d'un SW obsolète qui
  cache un bundle cassé. Runbook : DevTools → Application → Service
  Workers → Unregister + Clear storage.
- **Realtime + SW** : Workbox n'intercepte pas les WebSockets (voulu).
  Tout ce qui dépend de `supabase.channel()` (chat, notifs live,
  classement live) cesse de fonctionner hors ligne — c'est attendu.

## Conventions d'usage

- **Toute nouvelle feature réseau** : vérifier si un nouveau pattern
  Supabase (ex. `/storage/v1/render/image/...`) nécessite une entrée
  `runtimeCaching`. Sinon il tombera sur le défaut (pas de cache).
- **Toute modification du manifest** : éditer `vite.config.ts` →
  `VitePWA.manifest`, pas un fichier statique — sinon il est écrasé
  au build.
- **Tests** : les composants `<InstallPrompt />`, `<UpdatePrompt />`,
  `<OfflineBanner />` ont chacun leur test Vitest qui mocke
  `virtual:pwa-register/react` via `vi.hoisted()` pour partager les
  spies entre le mock et le test.
- **Dev** : `devOptions.enabled: false` — le SW est désactivé en dev
  pour ne pas polluer le HMR. Pour tester offline en dev :
  `pnpm build && pnpm preview`.

## Références

- ADR-0001 — Choix de stack : `docs/adr/0001-stack-react-supabase.md`
- ADR-0002 — State management : `docs/adr/0002-state-zustand-tanstack.md`
- Perf checklist : `docs/perf-checklist.md`
- `vite-plugin-pwa` : https://vite-pwa-org.netlify.app
- Workbox runtime caching : https://developer.chrome.com/docs/workbox/caching-strategies-overview
- PWA installation criteria : https://web.dev/install-criteria/
- Code :
  - Config : `vite.config.ts`
  - Hook : `src/features/pwa/update-prompt.tsx`
  - Bannière d'install : `src/features/pwa/install-prompt.tsx`
  - Bannière offline : `src/features/pwa/offline-banner.tsx`
  - Hook online status : `src/hooks/use-online-status.ts`
