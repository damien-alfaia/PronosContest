# CLAUDE.md — PronosticsContest v2

> Fichier de contexte lu automatiquement par Claude Code au démarrage.
> À déposer à la racine du nouveau projet `PronosticsContest-v2/`.

---

## 🎯 Projet

**PronosticsContest v2** est la réécriture complète d'une application .NET MVC 5 existante (pronostics sportifs : concours privés autour d'une compétition foot/rugby avec scoring pondéré par les cotes et classement en temps réel).

Les specs détaillées sont dans :
- `docs/PROMPT_REGENERATION_REACT_SUPABASE.md` — analyse de l'existant + prompt de régénération + schéma Supabase
- `docs/AGENTS_ET_SKILLS_CLAUDE.md` — agents & skills pour automatiser l'app

**⚠️ À lire avant tout développement.**

---

## 🛠️ Stack

- **Frontend** : React 18 + TypeScript + Vite + React Router v6
- **UI** : Tailwind CSS + shadcn/ui + lucide-react + framer-motion
- **State** : Zustand (global) + TanStack Query (server state)
- **Forms** : React Hook Form + Zod
- **Backend** : Supabase (Postgres + Auth + Storage + Realtime + Edge Functions)
- **Tests** : Vitest + React Testing Library + Playwright
- **i18n** : react-i18next (FR par défaut, EN en complément)
- **Dates** : date-fns + date-fns-tz
- **Charts** : Recharts
- **Déploy** : Vercel (front) + Supabase (back) + GitHub Actions (CI)

---

## 📁 Arborescence cible

```
src/
  app/            providers (query, auth, theme, i18n, router)
  features/       auth / concours / pronos / classement / admin / profile / notifications / badges
  components/
    ui/           composants shadcn
    layout/       Sidebar, Topbar, BottomNav
    common/
  hooks/
  lib/
    supabase.ts   client typé
    scoring.ts    helpers (le calcul reste en BDD)
    api/
  types/          types DB générés par `supabase gen types`
  stores/         zustand
  i18n/
  styles/
supabase/
  migrations/     SQL
  functions/      Edge Functions
  seed.sql
docs/
agents/           (phase 2) skills + agents Claude
```

---

## 📐 Conventions

### Code
- **TypeScript strict** (`"strict": true` + `"noUncheckedIndexedAccess": true`)
- **Named exports** uniquement (pas de default exports)
- **Fichiers** en `kebab-case.tsx`, **composants** en `PascalCase`, **hooks** en `useCamelCase`
- **Imports** triés : externes → alias `@/` → relatifs
- Pas de `any`, pas de `// @ts-ignore`. Si vraiment nécessaire : commentaire justifiant.
- Les composants UI vivent dans `components/ui/`, la logique métier dans `features/<domain>/`

### Git
- **Conventional commits** (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`)
- Une PR = une feature cohérente. Toujours accompagnée de tests.
- Branche : `feat/<scope>`, `fix/<scope>`
- Ne jamais commit sur `main` directement

### Supabase
- **Toutes** les tables ont RLS activée. Aucune exception.
- Les migrations vivent dans `supabase/migrations/`, horodatées, jamais modifiées après merge
- Le **service role key** n'est utilisée QUE dans les Edge Functions, jamais dans le front
- Les types TS sont régénérés via `supabase gen types typescript --local > src/types/database.ts` après chaque migration

### Scoring
- L'algorithme de classement reste **en Postgres** (fonction PL/pgSQL `compute_classement(concours_id uuid)`)
- Le front consomme une **vue matérialisée** `v_classement_concours` via Supabase Realtime
- Tests unitaires pgTAP obligatoires sur le scoring (10+ scénarios : poule complète, égalités, 4 meilleurs 3èmes, anciens/nouveaux pronos)

---

## ✅ Règles pour Claude

### Workflow
1. **Lire les specs** (`docs/PROMPT_REGENERATION_REACT_SUPABASE.md`) avant toute feature
2. **Poser les questions ambiguës** avant d'écrire du code
3. **Proposer un plan** en petites étapes, attendre validation avant d'exécuter
4. **Un commit = une étape cohérente** (pas de commit géant)
5. **Tests systématiques** : au minimum un test pour chaque fonction de logique métier
6. **Mettre à jour `docs/`** quand une décision d'archi est prise (créer une ADR dans `docs/adr/`)

### Interdits
- ❌ Hash de mot de passe maison (utiliser exclusivement Supabase Auth)
- ❌ Secrets en clair dans le repo (tout passe par `.env.local` + Vercel/Supabase env vars)
- ❌ Calcul du classement côté client (uniquement en SQL)
- ❌ Désactiver RLS "le temps de tester" (utiliser `service_role` depuis une Edge Function à la place)
- ❌ Install d'une dépendance majeure sans la justifier en commentaire de PR
- ❌ CSS inline / styled-components : **Tailwind uniquement**
- ❌ Modifier une migration déjà mergée : en créer une nouvelle

### Préférés
- ✅ Components shadcn/ui à copier-coller (pas de lib UI additionnelle)
- ✅ Server state via TanStack Query, jamais dans Zustand
- ✅ Optimistic updates quand le risque d'échec est faible
- ✅ Erreurs toujours typées (pas de `catch (e: any)`)
- ✅ Accessibilité : `aria-*`, focus management, navigation clavier

---

## 🚀 Commandes utiles

```bash
# Dev
pnpm dev                         # Vite en mode dev
pnpm build                       # Build prod
pnpm lint                        # ESLint
pnpm test                        # Vitest
pnpm test:e2e                    # Playwright
pnpm typecheck                   # tsc --noEmit

# Supabase (CLI)
supabase start                   # Stack locale (Docker)
supabase db reset                # Reset + rejoue migrations + seed
supabase db diff -f <nom>        # Génère une migration depuis le schéma local
supabase gen types typescript --local > src/types/database.ts
supabase functions serve         # Edge Functions en local
supabase functions deploy <nom>

# Qualité
pnpm format                      # Prettier
pnpm prepare                     # Husky hooks
```

---

## 🗺️ Roadmap (voir spec pour détail)

- [x] **Sprint 0** — Setup (Vite + TS + Tailwind + shadcn + Supabase structure + qualité)
- [x] **Sprint 1** — Auth + layout + i18n + theme
- [x] **Sprint 2** — Concours & compétitions (liste, création, recherche)
- [x] **Sprint 3** — Saisie de pronos
- [ ] **Sprint 4** — Scoring & classement Realtime (cœur)
- [ ] **Sprint 5** — Admin & import auto des matchs
- [ ] **Sprint 6** — Social & gamification (badges, chat, notifs)
- [ ] **Sprint 7** — PWA, perf, docs, lancement

Sprint courant : **Sprint 4** (Scoring & classement Realtime).

### Sprint 1 — récap (✅)

- **1.A** — Supabase local (`config.toml`, migration `profiles` + RLS + trigger + types générés), stores Zustand (`theme`, `auth`), providers (Query, Theme, Auth), hook `useAuth`, `ThemeToggle`.
- **1.B** — Schémas Zod auth (login/signup/forgot/reset/magicLink), erreurs typées (`TypedAuthError`), pages auth, guards `RequireAuth` / `RedirectIfAuth`, tests Vitest (34 tests).
- **1.C** — Layout app (Sidebar / Topbar / BottomNav / UserMenu / AppLayout), placeholders `concours` / `pronos` / `classement`, page profil avec `useQuery` + `useMutation` optimiste, `LanguageSwitcher`, i18n enrichi, ADR-0002 (Zustand client / TanStack Query server).

Checks verts : `typecheck` ✅ · `lint` ✅ (0 warning) · `test` 34/34 ✅ · `build` ✅.

### Sprint 2 — récap (✅)

- **2.A** — Migration `20260419130000_init_concours.sql` : 4 tables (`competitions`, `equipes`, `concours`, `concours_participants`) avec RLS, helper `is_participant(uuid)` en `SECURITY DEFINER` (coupe la récursion sur la policy SELECT de `cp`), trigger auto-génération de `code_invitation` + auto-ajout de l'owner comme `admin`, RPC `join_concours_by_code(text)`. Seed FIFA WC 2026 (48 équipes / 12 groupes A-L, tirage officiel 5 déc. 2025 + barrages UEFA et intercontinentaux). Types TS régénérés.
- **2.B** — `features/concours` : `schemas.ts` (Zod pour création / join par code / recherche, defaults scoring alignés sur le SQL), `api.ts` (`listMyConcours`, `listPublicConcours` avec échappement anti-wildcard, `getConcoursById`, `createConcours`, `joinPublicConcours`, `leaveConcours`, RPC `joinConcoursByCode`, `listCompetitions`, `listEquipesByCompetition`), `use-concours.ts` (query keys structurées + mutations avec invalidations ciblées). Pages : liste avec sections "Mes concours" / "Découvrir" + recherche `useDeferredValue`, création avec radio-group 3 visibilités, détail avec badges owner/member/visitor + code d'invitation copiable. UI primitives ajoutées : `badge`, `separator`, `textarea`.
- **2.C** — Modale `JoinByCodeDialog` (overlay + focus mgmt + Esc) avec mapping d'erreurs RPC (`not_found` / `not_joinable`). Tests Vitest (29 nouveaux : 18 schemas + 11 api avec builder supabase mocké). i18n FR/EN enrichi du bloc `concours.*`.

Checks verts : `typecheck` ✅ · `lint` ✅ (0 warning) · `test` 63/63 ✅ · `build` ✅.

### Sprint 3 — récap (✅)

- **3.A** — Migration `20260419210000_init_matchs_pronos.sql` : tables `matchs` (phase CHECK enum `groupes/seiziemes/huitiemes/quarts/demis/petite_finale/finale`, FK `equipe_a_id` / `equipe_b_id` + `ON DELETE RESTRICT`, `round`, `kick_off_at timestamptz`, `cote_a/b/nul` optionnels, `stade`, `ville`) et `pronos` (PK composite `(concours_id, user_id, match_id)`, `score_a/b` + CHECK 0..99, `vainqueur_tab` text CHECK `a/b`, NOT NULL via triggers côté app). RLS stricte : lecture des pronos des autres ouverte **uniquement après kick-off** via helper `is_match_locked(uuid)` en `SECURITY DEFINER STABLE`. Seed manuel des 72 matchs de la phase de groupes FIFA WC 2026 (12 groupes × 6 matchs, dates officielles). Types TS régénérés (`fifa_id` sur equipes, `matchs`, `pronos`, `is_match_locked` dans Functions).
- **3.B** — `features/pronos` : `schemas.ts` (Zod, partage du raffinement `vainqueur_tab` entre `pronoFormSchema` / `upsertPronoSchema`), `api.ts` (désambiguïsation FK `equipes!matchs_equipe_a_id_fkey` + `..._equipe_b_id_fkey`, `listMatchsByCompetition`, `listMyPronosInConcours`, `listPronosForMatchInConcours`, `upsertProno` avec `onConflict`, `deleteProno`), `use-pronos.ts` (query keys structurées + `useUpsertPronoMutation` / `useDeletePronoMutation` avec optimistic update complet `onMutate` → snapshot → patch → `onError` rollback → `onSettled` invalidate). Hooks partagés : `useCountdown` (tick 30s) + `useDebouncedCallback` (run / flush / cancel). `MatchCard` avec RHF + auto-save debouncé 600 ms (subscription `form.watch` filtrée sur `type === 'change'`, `form.reset(values, { keepValues: true })` pour clear le dirty flag), radios vainqueur TAB conditionnels (KO + égalité uniquement, reset auto sinon), Loader2 pendant save + Check emerald 1,5 s après succès, verrouillage coup d'envoi piloté par `useCountdown`. `PronosGridPage` sur `/app/concours/:id/pronos` : guards (membre uniquement), filtres statut (`all` / `todo` / `locked`) + groupe, tick 60 s pour que le filtre "Verrouillés" reste cohérent, sections par `round` (Map pour préserver l'ordre chrono), 2 états vides distincts. Bouton CTA "Saisir mes pronostics" ajouté sur la fiche concours (membres uniquement).
- **3.C** — Tests Vitest (44 nouveaux : 22 schemas pronos, 13 api pronos avec builder Supabase mocké, 9 `MatchCard` avec mock de `use-pronos` + i18n forcé en `fr`) et i18n FR/EN : bloc `pronos.*` complet (title / navigation / countdown templates / phase labels / filters / empty states / errors), clé `concours.actions.goToPronos`, placeholder `pages.pronos` mis à jour.

Checks verts : `typecheck` ✅ · `lint` ✅ (0 warning) · `test` 107/107 ✅ · `build` ✅.

---

## 🔑 Variables d'environnement

À placer dans `.env.local` (jamais commit) :

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
# server-only (Edge Functions) :
SUPABASE_SERVICE_ROLE_KEY=
API_FOOTBALL_KEY=
RESEND_API_KEY=
```

Un `.env.example` doit être tenu à jour à la racine.

---

## 📚 Références

- Specs complètes : `docs/PROMPT_REGENERATION_REACT_SUPABASE.md`
- Agents & skills : `docs/AGENTS_ET_SKILLS_CLAUDE.md`
- Supabase docs : https://supabase.com/docs
- shadcn/ui : https://ui.shadcn.com
- TanStack Query : https://tanstack.com/query

---

*Tiens ce fichier à jour au fil du projet — c'est la boussole de Claude.*
