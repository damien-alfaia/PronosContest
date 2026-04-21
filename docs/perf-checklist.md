# Perf checklist — PronosticsContest v2

> Référentiel de performance pour le MVP Sprint 7. Objectif : garder l'app
> rapide et installable (PWA) au lancement.

---

## 🎯 Cibles Lighthouse (mobile, throttling "Moyen")

| Catégorie         | Cible    | Bloquant ? |
| ----------------- | -------- | ---------- |
| Performance       | ≥ 85     | oui (MVP)  |
| Accessibility     | ≥ 95     | oui        |
| Best Practices    | ≥ 95     | oui        |
| SEO               | ≥ 95     | oui        |
| PWA (installable) | ✅ valide | oui        |

> Les cibles sont calibrées pour un premier paint depuis une connexion 4G
> moyenne sur un Moto G4 simulé. En desktop on vise 95+ partout.

---

## 🔬 Comment auditer

### 1. Build prod local

```bash
pnpm build
pnpm preview --host 0.0.0.0 --port 4173
```

Ouvrir `http://localhost:4173` dans Chrome **en navigation privée** (évite
les extensions qui faussent le score).

### 2. Lighthouse (Chrome DevTools)

1. Ouvrir DevTools → onglet **Lighthouse**
2. Cocher : Performance / Accessibility / Best Practices / SEO / PWA
3. Mode : **Navigation (Default)**
4. Device : **Mobile**
5. Clic sur "Analyze page load"

Re-faire l'audit sur 3 pages au minimum :

- `/` (Landing — SEO-critique)
- `/auth/login` (first paint d'un user non-loggé)
- `/app/dashboard` (après login — un chunk lazy)

### 3. Bundle analyzer

```bash
pnpm build:analyze
```

Ouvre `dist/stats.html` dans le navigateur. Vérifications :

- Chaque page `/app/*` doit apparaître dans un chunk séparé
  (`dashboard-page-*.js`, `concours-page-*.js`, etc.).
- Le chunk **entry** (main + ce qui est eager) ne doit pas dépasser
  **~400 Ko** gzipped.
- Pas de doublon `lucide-react` ou `zod` dans plusieurs chunks (tree-shaking
  OK).
- Pas de dépendance lourde inattendue dans le chunk admin (ex. `recharts`
  ne doit pas être tiré par une page publique).

---

## 🛠️ Optimisations déjà appliquées

| Optimisation                               | Où                                              | Sprint  |
| ------------------------------------------ | ----------------------------------------------- | ------- |
| Route-level code splitting (`lazy`)        | `src/app/providers/router.tsx`                  | 7.B.1   |
| PWA precache (`vite-plugin-pwa`)           | `vite.config.ts` → `VitePWA.workbox`            | 7.A     |
| Runtime caching Supabase REST (NetworkFirst 3s) | `vite.config.ts` → `workbox.runtimeCaching`     | 7.A.2   |
| Runtime caching Supabase Storage (CacheFirst 30j) | `vite.config.ts` → `workbox.runtimeCaching`     | 7.A.2   |
| TanStack Query `staleTime: 30s` par défaut | `src/app/providers/query-provider.tsx`          | 1       |
| Realtime opt-in (page active uniquement)   | `use-classement.ts`, `use-chat.ts`, `use-notifications.ts` | 4, 6    |
| `<img loading="lazy">` sur drapeaux équipes | `AdminEquipesPage`, `ConcoursCard`              | 2, 5    |
| `dense_rank` + index partiels (scoring)    | migrations 4.A, 6.C                             | 4, 6    |

---

## ⚠️ Pièges à éviter

- **Ne jamais `import * as Icons from 'lucide-react'`** → casse le
  tree-shaking. Toujours nommer les icônes individuellement.
- **Ne jamais faire un `useQuery` dans une page landing** → ça force le
  bundle à embarquer Supabase côté non-authentifié.
- **Éviter `Array.from(new Array(1000))`** dans les listes — préférer
  la pagination ou `IntersectionObserver`.
- **Ne pas précharger les chunks admin** sur une page user — le router
  ne fait pas de preload automatique, garder comme tel.

---

## 📈 Prochaines optimisations (post-MVP)

- [ ] Partial prerendering / SSR via Vercel Edge (si besoin après 500 users).
- [ ] Image CDN optimisé pour les drapeaux (Supabase Storage ne sert pas en
      AVIF/WebP auto — à rebrancher via un transformateur si on monte).
- [ ] Mesures RUM (Vercel Analytics ou Speed Insights) pour remplacer les
      audits ponctuels par des métriques réelles.
- [ ] `React.lazy` aussi sur les dialogs lourds (admin, modales CRUD).
- [ ] Audit d'accessibilité manuel (lecteur d'écran VoiceOver + NVDA).

---

## 🧪 Script de vérif rapide

```bash
# Check que le build prod tient bien dans les budgets
pnpm build

# Taille de l'entry bundle (gzip)
gzip -c dist/assets/index-*.js | wc -c

# Taille totale des chunks lazy
find dist/assets -name "*.js" -not -name "index-*.js" | xargs wc -c
```

---

*À tenir à jour : si une dépendance majeure est ajoutée (recharts, date-fns,
etc.), relancer `pnpm build:analyze` et documenter son impact ici.*
