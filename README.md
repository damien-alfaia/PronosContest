# PronosticsContest v2

Réécriture moderne de l'application de pronostics sportifs (concours privés autour d'une compétition football / rugby, scoring pondéré par les cotes, classement en temps réel).

Historique : migration d'une app .NET MVC 5 / Entity Framework / SQL Server vers **React + TypeScript + Supabase**.

> Les specs détaillées vivent dans `docs/` :
>
> - [`README-user.md`](./docs/README-user.md) — guide **utilisateur** (comptes, concours, pronos, classement, chat, badges, notifs, PWA)
> - [`README-admin.md`](./docs/README-admin.md) — guide **admin** (rôle global, pages `/app/admin/*`, invariants SQL)
> - [`perf-checklist.md`](./docs/perf-checklist.md) — cibles Lighthouse + procédure d'audit + bundle analyzer
> - [`PROMPT_REGENERATION_REACT_SUPABASE.md`](./docs/PROMPT_REGENERATION_REACT_SUPABASE.md) — analyse de l'existant + schéma Supabase + roadmap
> - [`AGENTS_ET_SKILLS_CLAUDE.md`](./docs/AGENTS_ET_SKILLS_CLAUDE.md) — plan d'agents & skills Claude pour automatiser l'app
> - [`adr/`](./docs/adr) — Architecture Decision Records (0001 stack, 0002 state, 0003 PWA)
>
> Le fichier [`CLAUDE.md`](./CLAUDE.md) à la racine sert de contexte permanent pour Claude.

---

## Stack

| Couche | Techno |
| --- | --- |
| Frontend | React 18 + TypeScript (strict) + Vite |
| Routing | React Router v6 |
| UI | Tailwind CSS + shadcn/ui + lucide-react |
| State | Zustand (global) + TanStack Query (server state) — dès Sprint 1 |
| Forms | React Hook Form + Zod — dès Sprint 2 |
| Backend | Supabase (Postgres + Auth + Storage + Realtime + Edge Functions) |
| Tests | Vitest + React Testing Library + Playwright (E2E au Sprint 7) |
| i18n | react-i18next (FR par défaut, EN en complément) |
| Qualité | ESLint + Prettier + Husky + lint-staged + commitlint |
| Déploiement | Vercel (front) + Supabase (back) |
| PWA | `vite-plugin-pwa` + Workbox + `workbox-window` (Sprint 7.A, voir [ADR-0003](./docs/adr/0003-pwa-service-worker.md)) |

---

## Prérequis

- **Node.js >= 20** (voir `.nvmrc`) — `nvm use` si tu utilises nvm.
- **pnpm >= 9** : `corepack enable && corepack prepare pnpm@latest --activate`
- **Docker Desktop** (pour la stack Supabase locale)
- **Supabase CLI** : `brew install supabase/tap/supabase`

## Installation

```bash
pnpm install
cp .env.example .env.local   # puis remplir les valeurs
```

## Commandes

```bash
# Dev
pnpm dev                         # Vite en mode dev (http://localhost:5173)
pnpm build                       # Build prod
pnpm build:analyze               # Build prod + ouvre dist/stats.html (treemap)
pnpm preview                     # Preview du build prod

# Qualité
pnpm lint                        # ESLint
pnpm lint:fix                    # ESLint + autofix
pnpm typecheck                   # tsc --noEmit
pnpm format                      # Prettier --write
pnpm format:check                # Prettier --check

# Tests
pnpm test                        # Vitest (run)
pnpm test:watch                  # Vitest (watch)

# Supabase (CLI)
supabase init                    # initialise supabase/ (une seule fois)
supabase start                   # stack locale (Docker)
supabase stop                    # arrête la stack locale
supabase db reset                # reset + rejoue migrations + seed
supabase db diff -f <nom>        # génère une migration depuis le schéma local
supabase gen types typescript --local > src/types/database.ts
supabase functions serve         # Edge Functions en local
```

## Variables d'environnement

Voir [`.env.example`](./.env.example). À copier en `.env.local` (non commit).

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` : client front.
- `SUPABASE_SERVICE_ROLE_KEY` : **server-only**, Edge Functions uniquement.
- `API_FOOTBALL_KEY` / `RESEND_API_KEY` : intégrations externes (Sprints 5-6).

## Arborescence

```
src/
  app/            providers (router, theme, i18n, auth, query)
  features/       auth / concours / pronos / classement / admin / profile / ...
  components/
    ui/           composants shadcn
    layout/       Sidebar, Topbar, BottomNav
    common/
  hooks/
  lib/
    supabase.ts   client typé
    utils.ts      helpers (cn, etc.)
    api/          wrappers
  types/          types DB générés par `supabase gen types`
  stores/         zustand
  i18n/           config + locales/{fr,en}.json
  styles/
  test/           setup vitest
supabase/
  migrations/     SQL (horodaté, jamais modifié après merge)
  functions/      Edge Functions
  seed.sql
docs/
  adr/            Architecture Decision Records
```

## Conventions

- **TypeScript strict** (`strict: true`, `noUncheckedIndexedAccess: true`)
- **Named exports** uniquement (pas de default export)
- Fichiers : `kebab-case.tsx`, composants : `PascalCase`, hooks : `useCamelCase`
- Imports triés : externes → alias `@/` → relatifs (ESLint `import/order`)
- **Conventional commits** obligatoires (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`...)
- **Toutes les tables Supabase ont RLS activée**. Aucune exception.

Plus de règles dans [`CLAUDE.md`](./CLAUDE.md).

## Roadmap

Voir [`docs/PROMPT_REGENERATION_REACT_SUPABASE.md §8`](./docs/PROMPT_REGENERATION_REACT_SUPABASE.md).

- [x] **Sprint 0** — Setup (Vite + TS + Tailwind + shadcn + Supabase structure + CI-ready)
- [x] **Sprint 1** — Auth + layout + i18n + theme
- [x] **Sprint 2** — Concours & compétitions (liste, création, recherche)
- [x] **Sprint 3** — Saisie de pronos
- [x] **Sprint 4** — Scoring & classement Realtime *(cœur)*
- [x] **Sprint 5** — Admin manuel (CRUD matchs + référentiel)
- [x] **Sprint 6** — Social & gamification (badges, chat, notifs)
- [x] **Sprint 7** — PWA, perf, docs *(en cours)*
- [ ] **Sprint 7 bonus** — import auto des matchs via API-Football *(reporté)*

## Licence

Privé — à définir.
