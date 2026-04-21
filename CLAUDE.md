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
- [x] **Sprint 4** — Scoring & classement Realtime (cœur)
- [x] **Sprint 5** — Admin (CRUD manuel matchs + référentiel)
- [ ] **Sprint 6** — Social & gamification (badges ✅, chat, notifs)
- [ ] **Sprint 7** — PWA, perf, docs, lancement + (optionnel) import auto API-Football

Sprint courant : **Sprint 6** (Social & gamification — 6.A badges ✅, reste 6.B chat, 6.C notifications).

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

### Sprint 4 — récap (✅)

- **4.A** — Migration `20260420160000_init_scoring_classement.sql` : colonnes `status` + `score_a/b`, `vainqueur_tab`, `penalty_score_a/b`, `fifa_match_id` sur `matchs` ; helper `resolve_cote_for_prono(match_id, score_a, score_b)` en `SECURITY INVOKER STABLE` (mappe 1/N/2 → `cote_a/cote_nul/cote_b`) ; vue `v_pronos_points` (issue de ≠s / exacts / base 1‑3 / bonus KO = 1 pt additif en KO si résultat correct avant TAB / `cote_appliquee` via resolver / `is_final` = `status` final + présence d'un résultat) ; vue **classique** `v_classement_concours` (CTE `totals` agrège `round(base * coalesce(cote,1))` par `(concours_id,user_id)`, `rang` calculé par `dense_rank() over (partition concours_id order by points desc, pronos_exacts desc, pronos_gagnes desc, prenom nulls last, nom nulls last)`, jointure `profiles` pour prenom/nom/avatar_url). RLS lecture des vues héritée des tables (concours_participants + matchs verrouillés). Publication `supabase_realtime` étendue à `matchs` + `pronos`. Tests SQL maison `supabase/tests/scoring.sql` — 13 scénarios en DO blocks `ASSERT` + `ROLLBACK` couvrant : base 1 pt bon résultat, 3 pts score exact, multiplication par cote (arrondi `round` pas `floor`), cote null = multiplicateur 1, bonus KO additif (`base + bonus) * cote`), prono non final ignoré, classement trié (points desc → exacts → gagnés → nom), `dense_rank` pour égalités parfaites, filtrage `is_final`, prono sans résultat ignoré. Types TS régénérés.
- **4.B** — `features/classement` : `schemas.ts` (Zod `classementRowSchema` / `pronoPointsRowSchema` avec enums phase/status + contraintes `rang>=1`, `cote_appliquee>=1`, normalizers `normalizeClassementRow` / `normalizePronoPointsRow` qui coalesce les nullables des vues et retournent `null` si `concours_id/user_id/match_id` manque, `computePronoTotal` = `Math.round((base + bonus) * (cote ?? 1))` avec court‑circuit `is_final=false → 0` en miroir exact du SQL), `api.ts` (`listClassement` ordonné `rang asc` + `points desc`, `listPronosPointsForUser` / `listAllPronosPointsInConcours` filtrés `is_final=true`, toutes utilisent les normalizers pour filtrer les lignes invalides, retour `[]` si `data` null), `use-classement.ts` (query keys structurées `classementKeys`, hooks `useClassementQuery` / `usePronosPointsForUserQuery` / `useAllPronosPointsInConcoursQuery` staleTime 10 s, `useClassementRealtime` souscrit à `matchs` UPDATE + `pronos` * filtré `concours_id=eq.${id}` et invalide `classementKeys.all` sur event, cleanup via `supabase.removeChannel`). Primitive shadcn `components/ui/table.tsx` ajoutée. Page `ConcoursClassementPage` sur `/app/concours/:id/classement` : guards (redirect liste si concours introuvable, redirect fiche si non membre), bannière "Ma position" avec `<Medal />` + rang + `pointsSummary`, table tri par rang avec badges top 3 teintés or/argent/bronze (light + dark), avatar `AvatarImage` + fallback initiales / "?", badge "Toi" inline, ligne de l'utilisateur surlignée `bg-primary/5` avec `aria-label="Ta ligne"`, colonnes Joués/Gagnés masquées `md:table-cell`, EmptyState dédié. Router mis à jour + CTAs "Voir le classement" ajoutés sur la fiche concours (membres) et lien retour dans la grille de pronos.
- **4.C** — Tests Vitest (35 nouveaux : 17 `schemas` — parsing, rejets, normalizers, `computePronoTotal` avec cas `is_final=false` / cote null / bonus additif / round ; 10 `api` — builder Supabase mocké, assertions sur `from`/`eq`/`order`, normalisation, filtrage des lignes invalides, propagation RLS ; 8 `concours-classement-page` — mocks `use-concours` / `use-classement` / `use-auth` pilotés par `detailState` / `classementState`, `renderPage` helper avec 3 routes MemoryRouter pour asserter les redirects, rendu titre / compétition / nom, état vide, ligne "moi" via `getByRole('row', { name: /ta ligne/i })`, bannière "Ma position", fallback initiales "AM", fallback "?" quand prenom+nom null). Correctif : ajout de `cote_a/b/nul: null` dans le factory `makeMatch` du test `match-card` (colonnes ajoutées par la migration Sprint 4). i18n FR/EN : bloc `classement.*` complet (title / backToConcours / goToPronos / myPosition / pointsSummary `{{points}} pts · {{exacts}} exact(s) · {{gagnes}} gagné(s)` / youLabel / rowMeAriaLabel / columns / empty) + clé `concours.actions.goToClassement`.

Checks verts : `typecheck` ✅ · `lint` ✅ (0 warning) · `test` 142/142 ✅ · `build` ✅.

### Sprint 5 — récap (✅)

- **5.A (Admin matchs)** — Migration `20260421120000_admin_matchs.sql` : équipes `matchs.equipe_a_id / equipe_b_id` passées en nullable (les 32 placeholders KO sont seedés avec dates / stades connus et équipes NULL tant que les groupes ne sont pas joués ; le CHECK `matchs_equipes_distinct` reste compatible car `null <> null` → `null` → pass) ; status étendu à `postponed` (4 autres `scheduled / live / finished / cancelled` déjà là) ; helper `public.is_admin(uuid?)` `SECURITY DEFINER STABLE` qui lit `profiles.role` et sert de point d'autorité unique pour toutes les policies admin ; policies RLS `matchs_insert/update/delete_admin` ; trigger `matchs_prevent_team_change_if_finished` qui protège l'historique scoring (interdit de réécrire les équipes d'un match terminé). Seed 32 placeholders KO ajouté (`20260421120000_seed_ko_placeholders.sql`). `features/admin/matchs` : `schemas.ts` (Zod `matchTeamsSchema` + `matchResultSchema` — preprocess `""` → `null`, vainqueur_tab uniquement si égalité + KO, penalty_score CHECK 0..99), `api.ts` (`listAdminMatchsByCompetition` avec désambiguïsation FK `equipes!matchs_equipe_a_id_fkey` + `..._equipe_b_id_fkey`, `updateMatchTeams`, `updateMatchResult`, `updateMatchStatus`, `resetMatchResult`), `use-admin-matchs.ts` (query keys `adminMatchsKeys.*`, mutations avec invalidation ciblée), guard `<RequireAdmin />` monté sous `<RequireAuth />` (spinner pendant la résolution, redirect silencieux vers `/app/dashboard` si non-admin, `<Outlet />` sinon). Hook `useIsAdmin()` avec `staleTime: 5 min`. Page `AdminMatchsPage` sur `/app/admin/matchs` : sélecteur de compétition (auto-sélection 1re), filtres phase + status côté client, table avec badges statut teintés (Clock / CircleDot / CheckCircle2 / ShieldAlert / XCircle) et dropdown d'actions par ligne (Saisir résultat / Assigner équipes / Changer statut / Reset), `MatchResultDialog` + `MatchTeamsDialog`. Entrées de menu admin ajoutées à la Sidebar (visibles uniquement si `isAdmin`).
- **5.B (Admin référentiel)** — Migration `20260422120000_admin_referentiel.sql` : policies RLS admin sur `competitions` (INSERT/UPDATE/DELETE via `is_admin()`), policies RLS admin sur `equipes` (idem), trigger `equipes_prevent_competition_change` qui bloque tout déplacement d'une équipe d'une compétition à une autre (renommer ou changer le code reste libre). FK existantes (inchangées) qui continuent de jouer leur rôle : `concours.competition_id → competitions.id ON DELETE RESTRICT`, `matchs.competition_id → competitions.id ON DELETE RESTRICT`, `matchs.equipe_a_id / equipe_b_id → equipes.id ON DELETE RESTRICT`. `features/admin/competitions` : `schemas.ts` (code slug `[a-z0-9-]+` 2..40 unique, nom 2..120, sport enum `football/rugby`, status enum `upcoming/live/finished`, dates preprocess `YYYY-MM-DD` tolérant `datetime-local`, `superRefine` CHECK `date_fin >= date_debut`, logo_url URL ou null), `api.ts` (`listCompetitionsAdmin` tri `date_debut desc` + `nom asc`, `createCompetition`, `updateCompetition`, `deleteCompetition`), `use-admin-competitions.ts` avec query keys `adminCompetitionsKeys.*`, page `AdminCompetitionsPage` (table, badge statut, CRUD via `CompetitionDialog`, suppression `window.confirm`, mapping 23505 → `competitionCodeTaken`, 23503 → `competitionInUse`). `features/admin/equipes` : `schemas.ts` (`competition_id` UUID verrouillé, code regex `[A-Z0-9]+` 2..10 unique par compétition, nom 2..80, groupe preprocess uppercase + trim + `""` → `null` + regex `[A-Z]`, drapeau_url URL ou null avec preprocess `""` → `null`, fifa_id preprocess `""` → `null` + string numérique → number int ≥ 1), `api.ts` (`listEquipesAdmin` tri `groupe asc NULLS LAST` + `nom asc`, `createEquipe`, `updateEquipe` qui n'envoie PAS `competition_id` en double sécurité du trigger SQL, `deleteEquipe`), page `AdminEquipesPage` (sélecteur compétition, table groupe/code/nom/fifa_id/drapeau `<img>`, CRUD via `EquipeDialog`, mapping 23505 → `teamCodeTaken`, 23503 → `teamInUse`).
- **5.C (Tests + i18n + docs)** — Tests Vitest massifs (~130 nouveaux tests admin) : `admin/matchs/__tests__` (schemas — preprocess, bornes, refinements vainqueur_tab ; api — builder Supabase mocké, désambiguïsation FK ; `admin-matchs-page` — rendu + filtres + dropdown ; `match-result-dialog` — submit avec UUID valides, mutateSpy appelé). `admin/competitions/__tests__` (17 tests schemas couvrant toutes les règles Zod, 9 tests api avec propagation 23505/23503/42501, 9 tests page avec `vi.hoisted()` pour partager l'état mock entre `vi.mock` et le test — contourne le TDZ dû au hoisting de `vi.mock`). `admin/equipes/__tests__` (20 tests schemas dont preprocess groupe uppercase + `""` → `null` + fifa_id string → number, 9 tests api avec check `updateEquipe` n'envoie PAS `competition_id`, 10 tests page avec même pattern `vi.hoisted`). i18n `admin.*` FR/EN complet : `admin.nav.*`, `admin.matchs.*` (title / filters / table / dialogs / status labels), `admin.competitions.*` (title / dialog / sport / status / dates), `admin.equipes.*` (title / dialog / groupe / fifa_id / drapeau), `admin.toast.*` (succès : matchUpdated / teamsUpdated / resultSaved / competitionCreated/Updated/Deleted / equipeCreated/Updated/Deleted), `admin.errors.*` (competitionCodeTaken / competitionInUse / teamCodeTaken / teamInUse / teamCompetitionLocked + messages Zod `admin.errors.teamCodeFormat` / `teamCodeTooShort` / `teamCodeTooLong` / `fifaIdRange` / `fifaIdInteger` / `competitionRequired` / `nomTooShort` / `nomTooLong` / `groupeFormat` / `drapeauUrlFormat`). Documentation : `docs/README-admin.md` (modèle d'autorisation, 3 pages admin, invariants SQL, mapping d'erreurs, checklist de promotion d'un utilisateur en admin).

Checks verts : `typecheck` ✅ · `lint` ✅ (0 warning) · `test` 273/273 ✅ · `build` ✅.

### Sprint 6.A — récap (✅ badges)

- **6.A.1 (Migration + seed + triggers)** — Migration `20260423120000_init_badges.sql` : tables `badges` (catalogue immuable, PK `code text`, CHECK `category` in (lifecycle, volume, skill, regularity, completude, classement, social, fun, temporal, legendary), CHECK `tier` in (bronze, silver, gold, legendary), `libelle`/`description` jsonb avec CHECK `? 'fr'` AND `? 'en'`, `icon text` = nom lucide-react, `sort_order int`) et `user_badges` (PK composite `(user_id, badge_code)` → idempotence native, FK `user_id → profiles.id ON DELETE CASCADE`, FK `badge_code → badges.code ON DELETE RESTRICT`, `earned_at timestamptz default now()`, `metadata jsonb default '{}'`). RLS stricte : `user_badges_select_self_or_same_concours` (lecture = self OR même concours via helper `is_participant`), aucune policy INSERT/UPDATE/DELETE anon (seuls les triggers `SECURITY DEFINER` écrivent). Seed 28 badges bilingues FR/EN couvrant les 10 catégories (ex : `rookie/pronostic_parfait/expert/concours_owner/host/premier_de_la_classe/podium/early_bird/night_owl/champion_du_monde`). Triggers AFTER ROW `SECURITY DEFINER` + `ON CONFLICT DO NOTHING` pour l'idempotence : `handle_badges_on_concours_insert` (auto-attribue `concours_owner` et `host` quand l'user en possède `>= 1` / `>= 3` — ≠ `=` pour rester correct sur INSERT multi-row), `handle_badges_on_pronos_insert` (`rookie` au 1er prono, `expert` au 50e), `handle_badges_on_matchs_finished` (parcourt les pronos du match terminé → `pronostic_parfait` si score exact, `early_bird` si prono saisi > 24 h avant kick-off, `night_owl` si saisi entre 0 h et 6 h locales). Publication `supabase_realtime` étendue à `user_badges`. Tests SQL maison `supabase/tests/badges.sql` (30+ scénarios DO block `ASSERT` + `ROLLBACK` : idempotence, seuils, cas bordure, RLS cross-user). Types TS régénérés.

- **6.A.2 (features/badges)** — `schemas.ts` (constantes `BADGE_CATEGORY_VALUES` / `BADGE_TIER_VALUES` / `BADGE_TIER_RANK` legendary=0 → bronze=3 ; `badgeLocalizedSchema` Zod `{fr,en}` min(1) ; `pickLocalized(localized, lang)` avec fallback fr ; `badgeCatalogRowSchema` + `normalizeBadgeCatalogRow` qui retourne `null` si code manquant ou libelle/description mal formé, coalesce `sort_order` null → 0 ; `userBadgeRowSchema` UUID user_id + ISO earned_at, `normalizeUserBadgeRow` retourne `null` si user_id/earned_at manquant, coalesce metadata non-objet → `{}` ; `userBadgeWithCatalogSchema` = extend + join ; `normalizeUserBadgeWithCatalog` retourne `null` si catalog joint absent ou invalide ; comparateurs `compareBadgeCatalog` (tier → sort_order → code) et `compareUserBadgeByRecent` (earned_at desc)). `api.ts` (`listBadgesCatalog` order sort_order asc, `listUserBadges` join `badge:badges(...)` + eq user_id + order earned_at desc, `countUserBadges` via `select('badge_code', { count: 'exact', head: true })`, toutes normalisent + filtrent les lignes invalides). `use-badges.ts` (query keys `badgesKeys.{all, catalog, userAll, userCount}` ; `useBadgesCatalogQuery` staleTime 1 h — catalogue immuable ; `useUserBadgesQuery` / `useUserBadgesCountQuery` staleTime 30 s + `enabled: Boolean(userId)` ; `useUserBadgesRealtime(userId)` souscrit channel `user-badges:${userId}` event `*` filtre `user_id=eq.${userId}` → invalide `userAll` + `userCount` à chaque event, cleanup via `supabase.removeChannel`). Volontairement **pas** d'import `Database` dans les fichiers badges : typage pur Zod pour que la feature reste résiliente tant que `supabase gen types` n'a pas réécrit `src/types/database.ts`.

- **6.A.3 (UI : BadgeTile + MyBadgesSection)** — `badge-icon.tsx` : `ICON_MAP: Record<string, LucideIcon>` statique de 27 icônes (`AlarmClock / Beer / CalendarRange / CheckSquare / CircleDot / ClipboardList / Crosshair / Crown / Eye / Flag / Flame / Footprints / Gem / LayoutGrid / Medal / Moon / Share2 / ShieldCheck / Snowflake / Sparkles / Sunrise / Swords / Target / TrendingUp / UserPlus / Users / Zap`) + fallback `HelpCircle`. Pas d'import dynamique → tree-shaking garanti + surface explicite. `badge-tile.tsx` : `TIER_STYLES: Record<BadgeTier, string>` chaînes Tailwind complètes (bronze=amber, silver=slate, gold=yellow, legendary=purple, light + dark), `TIER_ICON_STYLES` plus saturés ; composant `<BadgeTile>` `role="listitem"` avec `data-earned={earned}` + `aria-label={libelle}`, date de gain localisée via `toLocaleDateString(lang)`, opacity-60 + grayscale + border-dashed quand non gagné, description visible dans les deux états (sert d'objectif quand non gagné). `my-badges-section.tsx` : fonction pure `buildTiles(catalog, earned)` qui assemble les 2 sources en une liste triée (1. gagnés en premier, 2. chez gagnés : tier **desc** legendary d'abord + earned_at desc, 3. chez non-gagnés : tier **asc** bronze d'abord = objectifs accessibles qui donnent envie + sort_order asc). Composant `<MyBadgesSection userId>` Card avec Trophy amber + titre + progress `{earned} / {total} débloqués`, états loading (Loader2) / error (destructive text) / empty / normal (grid 2 → 5 cols `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5` avec `role="list"` et `aria-label`). Intégré dans `profile-page.tsx` après la Card profil.

- **6.A.4 (Tests Vitest + i18n)** — 3 fichiers de test badges : `schemas.test.ts` (~30 tests — constantes, Zod accept/reject, normalizers avec cas null/malformé/coalesce, `pickLocalized` fr/en, `compareBadgeCatalog` tier → sort_order → code, `compareUserBadgeByRecent` earned_at desc). `api.test.ts` (~10 tests — builder Supabase mocké avec `record(op, args)` + chain `select / eq / order / in / limit` + `then` pour les awaits, assertions sur `from('badges')`/`from('user_badges')`, select join `badge:badges`, count options `{count:'exact', head:true}`, filtrage des lignes invalides, `null data → []`, propagation erreurs dont RLS 42501). `my-badges-section.test.tsx` (~11 tests — `vi.hoisted()` pour partager `catalogState` / `userState` / `realtimeSpy` entre `vi.mock('@/features/badges/use-badges')` et les tests, i18n forcé en FR via `beforeAll`, couvre titre / progress / loading / error / empty / normal, tri gagnés avant non-gagnés via `data-earned`, tri gagnés legendary → gold → bronze via `aria-label`, tri non-gagnés bronze → gold → legendary, Realtime appelé avec `userId` courant ou `undefined`). i18n FR/EN : bloc minimal `badges.section.*` (title / progress `{{earned}} / {{total}} débloqués` / loading / loadError / empty / gridAriaLabel) — les libellés des 28 badges vivent dans les jsonb SQL (pas de dédoublonnage en i18n front).

> **Note supabase gen types** : la génération `supabase gen types typescript --local > src/types/database.ts` doit être relancée après la migration Sprint 6.A pour que `supabase.from('badges')` et `supabase.from('user_badges')` typent correctement. Les fichiers `features/badges/*` sont rédigés pour que les tests Vitest (qui mockent `@/lib/supabase`) passent même sans régénération — mais `pnpm typecheck` / `pnpm build` échouera côté front tant que les types ne sont pas rafraîchis.

Checks verts attendus après `supabase gen types` : `typecheck` ✅ · `lint` ✅ · `test` (273 + ~51 = ~324) ✅ · `build` ✅.

> **Reporté Sprint 7** : import automatique des matchs via API-Football (clé `API_FOOTBALL_KEY` déjà prévue dans `.env.example`). L'Edge Function d'import, la table de mapping `fifa_match_id ↔ api_football_id`, et le polling CRON sont volontairement hors périmètre du Sprint 5 pour livrer l'espace admin manuel en priorité. Tout le scoring est déjà branché à `matchs.status / score_a / score_b / vainqueur_tab` (Sprint 4), donc l'import auto n'aura qu'à écrire sur ces colonnes — la vue `v_classement_concours` et le Realtime front suivront sans changement.

> **Rappel "legacy skip" — règles v1 volontairement omises du MVP v2** :
>
> Ces règles existaient dans l'application .NET MVC 5 d'origine mais n'ont **pas** été réintroduites dans le scoring Sprint 4. Elles restent disponibles à ajouter plus tard si l'usage le justifie (cahier des charges explicite de ta part avant toute réintroduction) :
>
> 1. **14 coefficients de scoring** par type de phase/événement (poules, 8e, ¼, ½, petite finale, finale, score exact, tendance, etc.). Remplacés par un barème minimal : 1 pt résultat / 3 pts exact / +1 bonus KO additif / × cote.
> 2. **Distinction "ancien / nouveau prono"** (les pronos saisis après la phase de groupes rapportaient moins). Non pertinent tant qu'il n'y a qu'une seule saisie par match ; à réintroduire si on ouvre l'édition tardive de pronos.
> 3. **Bonus "poule complète"** (tous les matchs d'une poule pronostiqués avec le bon classement final donnaient un bonus). Absent du MVP.
> 4. **4 meilleurs 3èmes** (qualification de 4 troisièmes sur 6 en phase de groupes) : la logique de qualification/bracket n'est PAS calculée, seuls les pronos directs sont scorés.
> 5. **Sous-groupes de classement** (classement "potes", "famille", "collègues" à l'intérieur d'un concours). Non implémenté : un classement = un concours.
>
> Si tu veux en réintroduire une, on ouvrira un mini-sprint dédié avec migration additive + tests SQL spécifiques.

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
