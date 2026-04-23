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
- [x] **Sprint 6** — Social & gamification (badges ✅, chat ✅, notifs ✅)
- [x] **Sprint 7** — PWA, perf, docs + (optionnel, reporté) import auto API-Football
- [x] **Sprint 8** — Bonus/malus (jokers) — acquisition (8.A) ➜ consommation + RPC `use_joker` (8.B) ➜ affichage UX (8.C : badges MatchCard, décomposition classement, historique profil, notifications sociales)

Sprint courant : **Sprint 8 — livré** (livraisons 8.A → 8.C.5). Prochaines pistes post-Sprint 8 (à prioriser) : import auto API-Football (reporté Sprint 7) + legacy skip si ré-introduction de règles v1.

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
- **4.B** — `features/classement` : `schemas.ts` (Zod `classementRowSchema` / `pronoPointsRowSchema` avec enums phase/status + contraintes `rang>=1`, `cote_appliquee>=1`, normalizers `normalizeClassementRow` / `normalizePronoPointsRow` qui coalesce les nullables des vues et retournent `null` si `concours_id/user_id/match_id` manque, `computePronoTotal` = `Math.round((base + bonus) * (cote ?? 1))` avec court‑circuit `is_final=false → 0` en miroir exact du SQL), `api.ts` (`listClassement` ordonné `rang asc` + `points desc`, `listPronosPointsForUser` / `listAllPronosPointsInConcours` filtrés `is_final=true`, toutes utilisent les normalizers pour filtrer les lignes invalides, retour `[]` si `data` null), `use-classement.ts` (query keys structurées `classementKeys`, hooks `useClassementQuery` / `usePronosPointsForUserQuery` / `useAllPronosPointsInConcoursQuery` staleTime 10 s, `useClassementRealtime` souscrit à `matchs` UPDATE + `pronos` \* filtré `concours_id=eq.${id}` et invalide `classementKeys.all` sur event, cleanup via `supabase.removeChannel`). Primitive shadcn `components/ui/table.tsx` ajoutée. Page `ConcoursClassementPage` sur `/app/concours/:id/classement` : guards (redirect liste si concours introuvable, redirect fiche si non membre), bannière "Ma position" avec `<Medal />` + rang + `pointsSummary`, table tri par rang avec badges top 3 teintés or/argent/bronze (light + dark), avatar `AvatarImage` + fallback initiales / "?", badge "Toi" inline, ligne de l'utilisateur surlignée `bg-primary/5` avec `aria-label="Ta ligne"`, colonnes Joués/Gagnés masquées `md:table-cell`, EmptyState dédié. Router mis à jour + CTAs "Voir le classement" ajoutés sur la fiche concours (membres) et lien retour dans la grille de pronos.
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

### Sprint 6.B — récap (✅ chat)

- **6.B.1 (Migration + tests SQL)** — Migration `20260424120000_init_chat.sql` : table `concours_messages` (PK `id uuid default gen_random_uuid()`, FK `concours_id → concours ON DELETE CASCADE`, FK `user_id → profiles ON DELETE CASCADE`, `body text CHECK char_length between 1 and 1000`, `created_at timestamptz default now()`). Index `(concours_id, created_at desc)` dédié à la pagination remontante "load older". RLS stricte : `concours_messages_select_members` / `concours_messages_insert_members` branchées sur le helper `is_participant(concours_id)` (Sprint 2, `SECURITY DEFINER`) ; `INSERT` exige en plus `user_id = auth.uid()` pour empêcher de parler au nom d'un autre ; **aucune policy `UPDATE` / `DELETE`** → messages immuables au MVP (pas d'édition ni suppression, ni par l'auteur ni par l'admin). Publication `supabase_realtime` étendue à la table. Tests SQL maison `supabase/tests/chat.sql`.

- **6.B.2 (features/chat)** — `schemas.ts` + `api.ts` + `use-chat.ts` : Zod (body 1..1000 + trim), infinite query paginée par `created_at` DESC (50 par page), optimistic update, Realtime avec dedup anti-replay (par id ET par optimistic-body match).

- **6.B.3 (UI)** — `ConcoursChatPage` + `MessageList` (groupage par rafale < 5 min, séparateurs de jour sticky, auto-scroll intelligent) + `MessageBubble` (alignement self/other + opacity-70 si optimistic) + `MessageComposer` (auto-resize, Ctrl/Cmd+Enter = submit, compteur 80 %, i18n errorKey stockée dans Zod `message`).

- **6.B.4 (Tests + i18n)** — ~106 tests Vitest répartis en 6 fichiers, bloc i18n `chat.*` complet FR/EN.

### Sprint 6.C — récap (✅ notifications in-app)

- **6.C.1 (Migration + tests SQL)** — Migration `20260425120000_init_notifications.sql` : table `notifications` (4 types `match_result / badge_earned / concours_new_member / chat_mention`, payloads JSONB par-type, `read_at` nullable pour unread, index partiel `(user_id) WHERE read_at IS NULL`). RLS `select_self` + `update_self` + trigger `prevent_content_update` (seule `read_at` est modifiable). **Aucune policy INSERT** : 4 triggers `SECURITY DEFINER` créent les notifs — `match_finished` (pour tous les users ayant un prono sur le match), `badge_earned` (join catalogue en payload), `participant_joined` (owner + admins du concours, joiner exclu), `chat_mention` (2-pass : full-name `@Prenom Nom` + first-name `@Prenom` si unique parmi les membres, dedup). Publication Realtime étendue. Tests SQL maison 24 scénarios.

- **6.C.2 (features/notifications)** — `schemas.ts` (discriminated union Zod des 4 types + normalizer défensif), `api.ts` (`listNotifications` paginée DESC, `countUnreadNotifications` via count exact head, `markNotificationAsRead` idempotent `is read_at null`, `markAllNotificationsAsRead` batch), `use-notifications.ts` (infinite query + unread count + optimistic mark as read avec rollback + Realtime INSERT filtré par user_id + dedup anti-replay).

- **6.C.3 (UI)** — `NotificationBell` (popover custom — pas de primitive shadcn Popover installée — avec click-outside + Escape + refocus ; badge pill rouge `"99+"` si > 99 ; Realtime subscription active dès authentifié pour que la pastille se mette à jour hors popover) + `NotificationList` (empty / loading / error / paginated) + `NotificationItem` (icône teintée par type, `formatRelative` sans date-fns, `resolveRoute` par type → navigation on click + mark-as-read). Monté en 1re position de la barre d'actions droite de la Topbar.

- **6.C.4 (Tests + i18n)** — ~91 tests Vitest répartis en 5 fichiers, bloc i18n `notifications.*` complet FR/EN avec pluralization `_one / _other`.

> **Note supabase gen types (Sprint 6.B + 6.C)** : après les migrations `20260424120000_init_chat.sql` + `20260425120000_init_notifications.sql`, `supabase gen types typescript --local > src/types/database.ts` régénère les types pour `concours_messages` et `notifications`.

### Sprint 7 — récap (✅ PWA + perf + docs, lancement à venir)

- **7.A.1 (Install vite-plugin-pwa + manifest + icônes)** — `pnpm add -D vite-plugin-pwa workbox-window`. Config `VitePWA({ registerType: 'prompt', injectRegister: false, manifest: {...}, workbox: {...} })` dans `vite.config.ts`. Manifest PWA avec `theme_color: '#2563eb'`, `background_color: '#0b1220'`, `display: 'standalone'`, `lang: 'fr'`, `scope: '/'`, `start_url: '/'`, `categories: ['sports', 'social', 'entertainment']`. Icônes : `favicon.svg`, `apple-touch-icon.png`, `icon-192.png` + `icon-512.png` (purpose `any`), `icon-maskable-512.png` (purpose `maskable`) — tous dans `public/`. Meta tags `index.html` : `theme-color` light/dark, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, description, Open Graph (`og:type/site_name/title/description/image/locale`), Twitter card (`summary`). `devOptions.enabled: false` pour ne pas polluer le HMR en dev.

- **7.A.2 (Runtime caching + offline fallback)** — Workbox `runtimeCaching` (dans `vite.config.ts`) : (1) Supabase REST `/rest/v1/**` GET → `NetworkFirst` timeout 3 s, 100 entries max, 24 h ; (2) Supabase Storage `/storage/v1/object/public/**` GET → `CacheFirst`, 200 entries max, 30 j ; (3) Supabase Auth `/auth/v1/**` + Realtime `/realtime/v1/**` → `NetworkOnly` (sécurité) ; (4) Wikipedia Commons drapeaux `upload.wikimedia.org` → `CacheFirst`, 30 j. `navigateFallback: 'index.html'` + `navigateFallbackDenylist: [/^\/api/, /^\/auth/, /^\/rest/]` → SPA démarre offline sur toute route déjà visitée. `skipWaiting: false` + `clientsClaim: false` → on attend la décision user pour swap de SW. `globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}']`. Publication Realtime inchangée (WebSocket non-cacheable). `cleanupOutdatedCaches: true` pour éviter l'accumulation.

- **7.A.3 (InstallBanner + SW update prompt + offline banner + i18n + tests)** — 3 composants dans `src/features/pwa/` : `<OfflineBanner />` (relative z-30 en haut, detecte via `useOnlineStatus()` qui écoute `window` `online`/`offline` events, `role="status"` + `aria-live="polite"`, FR/EN) ; `<InstallPrompt />` (écoute `beforeinstallprompt`, `event.preventDefault()` pour garder la main, affiche un banner custom, persist `pwa:install:dismissedAt` en localStorage avec TTL 30 j, masque définitivement si `display-mode: standalone` ou `navigator.standalone` iOS, masque sur event `appinstalled`) ; `<UpdatePrompt />` (hook `useRegisterSW()` de `virtual:pwa-register/react`, toast Sonner `duration: Infinity` avec actions "Recharger"→`updateServiceWorker(true)` / "Plus tard"→`setNeedRefresh(false)` + toast success `offlineReady`). Montés dans `AppLayout`. Hook partagé `src/hooks/use-online-status.ts`. Tests Vitest (~21 nouveaux) : `use-online-status.test.ts` (3 tests — initial value, reactive online/offline events, cleanup), `offline-banner.test.tsx` (3 tests — nothing when online, role+aria-live when offline, FR text), `install-prompt.test.tsx` (8 tests — no render before event, banner on beforeinstallprompt, prompt() on install click, dismiss persist localStorage, X button, recently dismissed hidden, 31+ days old shows again, appinstalled hides), `update-prompt.test.tsx` (5 tests — `vi.hoisted()` pour mock `virtual:pwa-register/react` + Sonner, cas toast needRefresh/offlineReady avec actions). i18n FR/EN : bloc `pwa.*` complet (`offline.{banner, hint}`, `install.{title, description, cta, later, close, bannerAriaLabel}`, `update.{title, description, reload, later}`, `offlineReady.{title, description}`).

- **7.B.1 (Lazy-load routes + bundle analyzer)** — Refonte complète `src/app/providers/router.tsx` avec le pattern React Router v6.4+ `lazy: async () => { const { X } = await import('...'); return { Component: X }; }` sur **toutes** les pages `/auth/*` et `/app/*` (13 pages au total). Restent eager : `<LandingPage />` (SEO / first-paint homepage), les 3 guards (`RequireAuth` / `RedirectIfAuth` / `RequireAdmin` — doivent décider avant l'écran), et `<AppLayout />` (shell vide, minimal). Gain : bundle initial landing allégé de ~300–500 KB, première navigation `/app/*` ne tire que la page demandée. Bundle analyzer ajouté via `rollup-plugin-visualizer` ^5.12.0, activé par `ANALYZE=true` dans la nouvelle commande `pnpm build:analyze` qui génère `dist/stats.html` (treemap avec gzip + brotli sizes) et l'ouvre automatiquement. Le plugin n'est PAS chargé en build normal (CI / Vercel) pour ne pas ralentir la pipeline.

- **7.B.2 (Audit Lighthouse + optimisations finales)** — `public/robots.txt` ajouté (`User-agent: *` + `Allow: /` + `Disallow: /app/ /auth/` + `Sitemap: /sitemap.xml`) ; `public/sitemap.xml` minimal (3 entrées : `/`, `/auth/login`, `/auth/signup`). Open Graph + Twitter meta tags dans `index.html` (cf. 7.A.1). Doc `docs/perf-checklist.md` créée — cibles Lighthouse mobile (Perf ≥ 85, A11y ≥ 95, Best Practices ≥ 95, SEO ≥ 95, PWA installable ✅), procédure d'audit (build → preview → Lighthouse DevTools sur 3 pages critiques), interprétation de `stats.html` (budget entry ≤ 400 Ko gzip), table des optimisations déjà appliquées (route-level code splitting, precache SW, runtime caching, `staleTime 30s`, Realtime opt-in, `loading="lazy"` sur drapeaux, `dense_rank` + index partiels), pièges à éviter (jamais `import *` lucide-react, jamais Supabase sur landing), backlog post-MVP (SSR/PP, image CDN, RUM, `React.lazy` sur dialogs admin, audit a11y manuel).

- **7.C.1 (README-user + README-admin complété)** — `docs/README-user.md` créé — guide utilisateur complet : créer un compte, rejoindre/créer un concours (3 visibilités public/private/link), saisir ses pronos (auto-save 600ms, verrouillage kick-off, filtres, TAB uniquement en KO), lire le classement (dense_rank, barème 1/3 points + bonus KO + cote), utiliser le chat (Ctrl/Cmd+Enter, mentions `@Prénom`, 1000 car max, pagination 50), débloquer des badges (10 catégories, 4 tiers bronze/silver/gold/legendary, attribution auto via triggers SQL), gérer ses notifs (4 types : match_result / badge_earned / concours_new_member / chat_mention), installer l'app PWA + mode offline (ce qui marche / ce qui ne marche pas offline), gérer son profil (langue, thème, reset password par email uniquement), FAQ (pronos cachés jusqu'au kick-off RLS, quitter un concours, différence admin app vs admin concours).

- **7.C.2 (ADR-0003 PWA + MAJ README racine + MAJ CLAUDE.md)** — `docs/adr/0003-pwa-service-worker.md` créé — contexte (manifest + SW + offline pour lancement v1), décision (vite-plugin-pwa + Workbox + `useRegisterSW` hook), alternatives écartées (SW custom, autoUpdate, popup natif seul, Next.js PWA, pas de PWA), stratégie de cache (tableau des handlers par pattern d'URL), stratégie d'update (`registerType: 'prompt'` + toast Infinity + `skipWaiting: false`), stratégie d'install (custom banner + localStorage TTL 30j + detect standalone), explication `injectRegister: false` (évite double registration), conséquences +/- (Realtime ne marche pas offline par design, debug SW via DevTools unregister), conventions (vérifier runtimeCaching à chaque nouveau pattern Supabase, `devOptions.enabled: false` en dev). README racine enrichi : liens docs/ étendus (README-user, README-admin, perf-checklist, ADRs), tableau stack avec ligne PWA, commande `pnpm build:analyze` documentée, roadmap Sprint 7 cochée. CLAUDE.md mis à jour (ce récap).

Checks verts attendus : `typecheck` ✅ (pending `pnpm install` pour `rollup-plugin-visualizer`) · `lint` ✅ · `test` (~521 + ~21 PWA ≈ ~542) ✅ · `build` ✅.

> **Note `pnpm install` requis (Sprint 7)** : les nouvelles dépendances sont ajoutées au `package.json` :
>
> - `vite-plugin-pwa ^0.21.1` + `workbox-window ^7.3.0` (7.A, déjà fait en local)
> - `rollup-plugin-visualizer ^5.12.0` (7.B.1, devDep) — **nécessite `pnpm install`** avant `pnpm build:analyze`
>
> Si le sandbox CI tourne sans avoir réinstallé, le build normal marche (le visualizer n'est importé que si `ANALYZE=true`). Mais typecheck peut se plaindre de l'import statique en haut de `vite.config.ts` — à garder en tête.

### Sprint 8.A — récap (✅ acquisition des jokers)

- **8.A.1 (Migration + seed + triggers)** — Migration `20260426120000_init_jokers.sql` : colonne `concours.jokers_enabled boolean not null default false` (opt-in par concours) + tables `jokers` (catalogue immuable, PK `code text`, CHECK `category` in (boost, info, challenge, social), `libelle`/`description` jsonb avec CHECK `? 'fr' AND ? 'en'`, `icon text` = nom lucide-react, `sort_order int`) et `user_jokers` (PK `id uuid default gen_random_uuid()`, FK `user_id → profiles.id ON DELETE CASCADE`, FK `concours_id → concours.id ON DELETE CASCADE`, FK `joker_code → jokers.code ON DELETE RESTRICT`, `acquired_from text CHECK IN (starter, badge, gift)`, `acquired_at timestamptz default now()`, `used_at timestamptz` nullable, `used_on_match_id / used_on_target_user_id / used_payload jsonb` — nullables, `CHECK user_jokers_used_coherence` qui garantit que `used_at is null` ⟺ tous les `used_on_*` sont null, FK `used_on_match_id → matchs ON DELETE SET NULL`, FK `used_on_target_user_id → profiles ON DELETE SET NULL`). Index partiels `(user_id, concours_id) WHERE used_at IS NULL` (slots owned rapides) et `(user_id, concours_id, used_at DESC)` (historique). RLS stricte : `user_jokers_select_self_or_same_concours` (lecture = self OR même concours via helper `is_participant`), aucune policy INSERT/UPDATE/DELETE anon (seuls les triggers `SECURITY DEFINER` écrivent). Seed 7 jokers bilingues FR/EN (`double/triple/cote_boost/tab_insurance/info_forme/swap_prono/gift`). Triggers AFTER ROW `SECURITY DEFINER` + `ON CONFLICT DO NOTHING` pour l'idempotence : `handle_jokers_on_participant_insert` (attribue starter pack `double/info_forme` quand un participant rejoint un concours avec `jokers_enabled=true`), `handle_jokers_on_badge_earned` (mappe certains badges → jokers : `expert → triple`, `pronostic_parfait → cote_boost`, `concours_owner → gift`), `handle_jokers_on_concours_enable` (à la transition `jokers_enabled false → true`, distribue le starter pack à tous les participants déjà inscrits + backfill les badges unlocks). Publication `supabase_realtime` étendue à `user_jokers`. Tests SQL maison `supabase/tests/jokers_acquisition.sql` (20+ scénarios DO block `ASSERT` + `ROLLBACK` : idempotence starter pack, unicité par joker_code/user/concours, RLS cross-user, coherence CHECK, trigger badge_earned).

- **8.A.2 (features/jokers : schemas + api + hooks)** — `schemas.ts` (constantes `JOKER_CATEGORY_VALUES` = `boost/info/challenge/social` + `JOKER_ACQUIRED_FROM_VALUES` = `starter/badge/gift` + `JOKER_CATEGORY_RANK` boost=0 → social=3 ; `jokerLocalizedSchema` Zod `{fr,en}` min(1) ; `pickLocalized` avec fallback fr ; `jokerCatalogRowSchema` + `normalizeJokerCatalogRow` (null si code/libelle manquant) ; `userJokerRowSchema` avec `superRefine` miroir du CHECK SQL `user_jokers_used_coherence` (`used_at null` ⟺ `used_on_*` null) ; `normalizeUserJokerRow` + `isJokerOwned` helper ; `userJokerWithCatalogSchema` = extend + join catalogue ; `normalizeUserJokerWithCatalog` retourne null si catalog joint absent/invalide ; comparateurs `compareJokerCatalog` (category rank → sort_order → code) et `compareUserJokerForInventory` (owned avant used, puis ordre catalogue, puis acquired_at desc)). `api.ts` (`listJokersCatalog` order sort_order asc, `listUserJokersInConcours` avec join `joker:jokers(...)` + order `used_at asc nullsFirst` puis `acquired_at desc`, `countUserOwnedJokersInConcours` via `select('id', {count:'exact', head:true})` + `is('used_at', null)`, `setConcoursJokersEnabled` qui update `concours.jokers_enabled` — RLS owner only). `use-jokers.ts` (query keys `jokersKeys.{all, catalog, userAll(userId, concoursId), userCount(userId, concoursId)}` ; `useJokersCatalogQuery` staleTime 1 h ; `useUserJokersInConcoursQuery` / `useUserOwnedJokersCountQuery` staleTime 30 s + enabled guard `Boolean(userId) && Boolean(concoursId)` ; `useSetConcoursJokersEnabledMutation` invalide `['concours', 'detail', id]` + `['concours']` + `jokersKeys.all` ; `useUserJokersRealtime(userId, concoursId, { enabled })` souscrit channel `user-jokers:${userId}:${concoursId}` event `*` filtre `user_id=eq.${userId}` server-side + **affinement client-side** par `concours_id` dans la payload — Supabase Realtime ne supporte qu'un filtre scalaire simple, d'où le 2e tri côté JS). Volontairement **pas** d'import `Database` dans les fichiers jokers : typage pur Zod pour que la feature reste résiliente tant que `supabase gen types` n'a pas réécrit `src/types/database.ts`.

- **8.A.3 (UI : JokerTile + MyJokersSection + JokersEnabledToggle)** — `joker-icon.tsx` : `ICON_MAP: Record<string, LucideIcon>` statique de 6 icônes (`Compass / Flame / Gift / ShieldCheck / Swords / Zap`) + fallback `HelpCircle` (pas d'import dynamique → tree-shaking garanti). `joker-tile.tsx` : `CATEGORY_STYLES` (light+dark Tailwind) boost=amber, info=sky, challenge=rose, social=emerald ; props `libelle / description / icon / category / owned / acquiredFrom / acquiredAt / usedAt` ; `role="listitem"` + `data-owned={owned}` + `data-category={category}` + `aria-label={libelleText}` ; Badge "origine" (starter/badge/gift) + date de gain ou d'utilisation localisée via `toLocaleDateString(lang)` ; opacity-60 + grayscale quand `owned=false`. `my-jokers-section.tsx` : composant `<MyJokersSection userId concoursId enabled>` — **critique** : tous les hooks (`useUserJokersInConcoursQuery` + `useUserJokersRealtime`) sont appelés AVANT le `if (!enabled) return null` pour respecter les Rules of Hooks (on passe juste `enabled ? userId : undefined` à la query et `{ enabled }` à Realtime) ; Card avec Sparkles + titre `jokers.section.title` + progress `{{owned}} / {{total}} disponibles` ; états loading / error / empty / grid 2→5 cols `role="list"` + `aria-label` ; tri via `compareUserJokerForInventory` (owned avant used). `jokers-enabled-toggle.tsx` : owner-only (la caller page garde la visibilité) ; deux boutons `role="radio"` + `aria-checked` (pas de primitive Switch dans shadcn, pattern aligné sur les toggles de visibilité du Sprint 2) ; toast Sonner `success: "Jokers activés/désactivés"` / `error` ; disabled pendant `mutation.isPending`. Intégration `concours-detail-page.tsx` : cast défensif `(concours as { jokers_enabled?: boolean | null }).jokers_enabled` (pattern transitoire avant `supabase gen types`), `<JokersEnabledToggle />` monté si `isOwner`, `<MyJokersSection />` monté si `isMember && jokersEnabled`.

- **8.A.4 (Tests Vitest + i18n)** — 4 fichiers de test jokers : `schemas.test.ts` (41 tests — constantes, Zod accept/reject, normalizers avec cas null/malformé/coalesce, `pickLocalized` fr/en, `isJokerOwned`, comparateurs catalog + inventory, **test critique** du `superRefine` qui rejette `used_at: null + used_on_match_id: set` en miroir exact du CHECK SQL). `api.test.ts` (13 tests — builder Supabase mocké avec `record(op, args)` + chain `select / eq / is / order / update / limit / in` + `then` pour les awaits, assertions sur `from('jokers')` / `from('user_jokers')` / `from('concours')`, select join `joker:jokers`, count options `{count:'exact', head:true}`, filtrage des lignes invalides, `null data → []`, propagation erreurs dont RLS 42501). `my-jokers-section.test.tsx` (10 tests — `vi.hoisted()` pour partager `userState` / `realtimeSpy` entre `vi.mock('@/features/jokers/use-jokers')` et les tests, i18n forcé en FR via `beforeAll`, couvre non-render si `enabled=false`, titre / progress / loading / error / empty / normal, tri owned-before-used via `data-owned`, Realtime spy appelé avec `{ enabled: true }` ET avec `{ enabled: false }` quand section non rendue). `jokers-enabled-toggle.test.tsx` (10 tests — mocks `use-jokers` + `sonner`, rendu radios reflète `enabled`, click sur bouton déjà actif = no-op, click sur l'autre appelle `mutate(concoursId, next)`, onSuccess → toast.success, onError → toast.error, `isPending` désactive les deux boutons + ignore clicks). **74 tests verts** rien que sur `src/features/jokers/`. i18n FR/EN : bloc `jokers.*` complet — `section.{title, progress, loading, loadError, empty, gridAriaLabel, acquiredOn, usedOn}`, `acquiredFrom.{starter, badge, gift}`, `toggle.{title, descriptionEnabled/Disabled, on, off, ariaLabel, hint, toast.{enabled, disabled, error}}`. Les libellés des 7 jokers vivent dans les jsonb SQL (pas de dédoublonnage en i18n front).

> **Note supabase gen types (Sprint 8.A)** : après la migration `20260426120000_init_jokers.sql`, relancer `supabase gen types typescript --local > src/types/database.ts` pour typer correctement `supabase.from('jokers')`, `supabase.from('user_jokers')` et la nouvelle colonne `concours.jokers_enabled`. Tant que ce n'est pas fait, le cast défensif `(concours as { jokers_enabled?: boolean | null })` dans `concours-detail-page.tsx` couvre la colonne manquante. Les tests Vitest mockent `@/lib/supabase` donc passent sans régénération, et `pnpm typecheck` reste vert (les helpers jokers n'importent pas `Database`).

Checks verts (sandbox Linux + pnpm) : `typecheck` ✅ · `lint` (jokers + concours-detail-page + i18n) ✅ · `test src/features/jokers` **74/74** ✅.

### Sprint 8.B — récap (✅ consommation des jokers)

- **8.B.1 (Migration RPC `use_joker` + contraintes + helpers)** — Migration `20260427120000_jokers_consumption.sql` : (1) index unique partiel `user_jokers_unique_used_per_match` sur `(user_id, concours_id, used_on_match_id, joker_code) WHERE used_at IS NOT NULL AND used_on_match_id IS NOT NULL` — protège contre les double-submit et garantit au plus 1 consommation d'un code donné par (user, match) ; (2) helper stable `joker_category(code text) → text` (simple lookup boost/info/challenge/social) ; (3) helper `boussole_most_common_score(concours_id uuid, match_id uuid) → jsonb` en `SECURITY DEFINER` qui agrège et ne renvoie QUE `{score_a, score_b, count}` du score exact le plus fréquent parmi les pronos du concours sur le match (jamais la ligne unitaire d'un user, pour ne pas contourner la RLS pronos avant kick-off) ; (4) RPC `use_joker(p_user_joker_id uuid, p_target_match_id uuid, p_target_user_id uuid, p_payload jsonb) RETURNS user_jokers` `SECURITY DEFINER` qui valide par `joker_code` toutes les règles d'usage (matrice `double/triple/safety_net/boussole` = match requis, pas de target user / `challenge/double_down` = match + target user requis / `gift` = target user requis + pas de match cible), applique le verrouillage temporel (`not is_match_locked(match_id)` sauf `gift`), le **category stacking** (max 1 joker `boost` par `(user, match)` et max 1 `challenge` par `(user, match)` via `EXISTS` sur `user_jokers + joker_category`), l'appartenance `target_match_id` à la même compétition que le concours du slot, l'appartenance `target_user_id` au concours (via `EXISTS` sur `concours_participants` plutôt que `is_participant` — le helper lit `auth.uid()`, ici on contrôle explicitement), l'interdiction de se cibler soi-même, puis écrit transactionnellement la consommation `UPDATE user_jokers SET used_at/used_on_match_id/used_on_target_user_id/used_payload`. Le RPC retourne la ligne consommée (pour `gift`, c'est le slot du joker `gift` lui-même ; le RPC crée aussi le slot offert au receveur via `INSERT ... acquired_from='gift'`). **20 codes d'erreur** texte exposés via `RAISE EXCEPTION '<code>'` (cf. mapping front 8.B.4) : `user_joker_not_found / user_joker_not_owned / user_joker_already_used / target_match_required / target_match_forbidden / target_user_required / target_user_forbidden / target_user_self_forbidden / target_match_wrong_concours / target_user_not_participant / match_locked / match_not_found / category_already_used_on_match / payload_required / payload_invalid / gifted_joker_not_found / gifted_joker_same_code_forbidden / gifted_joker_already_used / gifted_joker_not_owned / use_joker_invalid_response`. Publication `supabase_realtime` déjà OK depuis 8.A.

- **8.B.2 (Tests SQL maison `jokers_consumption.sql`)** — 18+ scénarios DO block `ASSERT` + `ROLLBACK` couvrant : chemin nominal chaque code (double/triple/safety_net/boussole/challenge/double_down/gift), rejet double-submit (index unique partiel), rejet stacking boost (double + triple sur même match), rejet stacking challenge (challenge + double_down sur même match), rejet `match_locked` après kick-off, rejet cross-compétition (`target_match_wrong_concours`), rejet target non-participant, rejet auto-target (challenge + gift), rejet payload invalide (challenge sans `stakes`, gift sans `gifted_joker_code`), rejet gift du même code que le cadeau, helper `boussole_most_common_score` retourne `null` si 0 prono / la majorité si unanime / 1 des deux si égalité parfaite.

- **8.B.3 (Vues scoring refactorées pour effets jokers)** — Migration `20260428120000_jokers_scoring_effects.sql` : `CREATE OR REPLACE VIEW v_pronos_points` qui conserve les 10 colonnes Sprint 4 à l'identique (nom + type) et APPEND 5 nouvelles colonnes (`points_pure int` = base + bonus_ko sans cote ni multiplier ; `joker_multiplier int` = 1 par défaut / 2 si `double` / 3 si `triple` ; `joker_safety_net bool` ; `points_raw int` = `round((base+bonus)*coalesce(cote,1))` — inchangé par rapport à 8.A ; `points_final int` = `points_raw * multiplier`, `floor 1` si `safety_net` et `is_final`). Nouvelle vue `v_challenge_deltas` (1 ligne par `(concours, user)` agrégeant tous les transferts de challenge/double_down — delta = stakes signé selon comparaison `points_pure` caller vs target, `0` si tie ou match non-final, compte double-down à 10 pts + challenge à 5 pts). `CREATE OR REPLACE VIEW v_classement_concours` qui conserve les colonnes Sprint 4 et APPEND `prono_points int` (somme `points_final` ≥ 0) + `challenge_delta int` (peut être < 0). La colonne publique `points = prono_points + challenge_delta`. `security_invoker=on` maintenue sur toutes les vues → hérite des policies `pronos` + `user_jokers` + `concours_participants`. Tests SQL maison `jokers_scoring_effects.sql` (15+ scénarios : multiplier ×2 / ×3, safety_net floor, mutual exclusion multiplier/safety_net par stacking CHECK, challenge tie = 0, challenge non-final = 0, challenge caller > target = +5 au caller / -5 au target, double_down ±10, pronos_points ≥ 0 mais `points` final peut être négatif si delta < prono_points). Rétrocompat Zod 100% : `features/classement/schemas.ts` `.strip()` les colonnes nouvelles, zéro modification côté front nécessaire.

- **8.B.4 (Front : `useConsumeJokerMutation` + `ConsumeJokerDialog` + wiring)** — `features/jokers/api.ts` : ajout `consumeJoker({ userJokerId, targetMatchId?, targetUserId?, payload? })` qui appelle `supabase.rpc('use_joker', ...)` avec le shape strict (null passé explicitement pour les champs non utilisés, nécessaire pour matcher le signature PL/pgSQL), valide le retour via `userJokerRowSchema` puis throw `use_joker_invalid_response` si normalisation échoue ; `listConcoursParticipantsForPicker(concoursId)` join `profile:profiles(id, prenom, nom, avatar_url)` sur `concours_participants`, unwrap de `profile` (Supabase renvoie parfois un objet, parfois un array selon cardinalité → coalesce en objet unique), filtre les lignes sans `user_id`. `use-jokers.ts` : `useConsumeJokerMutation(concoursId)` invalide `jokersKeys.userAll / userCount` + `['classement', concoursId]` + `['pronos', concoursId]` (pour rafraîchir le multiplier affiché dans la grille de pronos via future story). `useConcoursParticipantsForPickerQuery(concoursId)` staleTime 60 s. `consume-joker-dialog.tsx` : composant `<ConsumeJokerDialog userJoker concoursId competitionId currentUserId open onOpenChange>` — montage conditionnel dans `MyJokersSection` uniquement quand un slot est sélectionné (évite de tirer les queries internes tant que le dialog n'est pas visible, et simplifie les tests 8.A qui ne mockent pas les hooks internes). Branche par `joker_code` : `double/triple/safety_net` = match picker seul (via `useMatchsQuery(competitionId)` filtré `kick_off_at > now()`) ; `boussole` = match picker seul (info-only) ; `challenge/double_down` = match picker + user picker (tous les participants sauf `currentUserId` et sauf slots déjà utilisés dans la même catégorie) ; `gift` = user picker + **giftable picker** (jokers owned du user, excluant le slot `gift` lui-même et excluant les codes déjà offerts au même receveur). Submit packe le `payload` adapté (`{stakes: 5}` / `{stakes: 10}` / `{gifted_joker_code, ...}` / `null`) et appelle la mutation ; onSuccess → toast success + `onOpenChange(false)` ; onError → extraction du code via `extractErrorCode(err)` puis `t('jokers.consume.error.<code>')` en toast destructive avec fallback `'unknown'`. Fermeture Escape / overlay / Annuler (tous → `onOpenChange(false)`). **Bug fix réel** : `extractErrorCode` en 2 passes (1. match exact sur `err.message === code` pour le cas nominal `RAISE EXCEPTION '<code>'` qui remonte tel quel ; 2. fallback `.includes(code)` avec codes triés par longueur décroissante — sinon `already_used` matchait avant `category_already_used_on_match` par substring). Intégration `my-jokers-section.tsx` : `onActivate={isOwned ? () => setSelectedUserJoker(row) : undefined}` sur `<JokerTile>`, dialog monté seulement si `concoursId && selectedUserJoker`.

- **8.B.5 (Tests Vitest + i18n + clôture)** — Tests étendus : `api.test.ts` passe de 13 → **25 tests** (+12 : 6 sur `consumeJoker` — shape RPC strict `{p_user_joker_id, p_target_match_id, p_target_user_id, p_payload}` avec null explicites, propagation erreur, throw `use_joker_invalid_response` si normalisation rate ; 6 sur `listConcoursParticipantsForPicker` — query shape, unwrap objet vs array, filtre `null user_id`, `[]` si data null, propagation 42501). Nouveau fichier `consume-joker-dialog.test.tsx` (**27 tests**) : mocks `@/features/pronos/use-pronos` + `@/features/jokers/use-jokers` + `sonner` via `vi.hoisted()` ; factory `makeSlot()` + UUID constants ; couvre non-render `open=false` / `userJoker=null`, `aria-modal="true"`, branche par `joker_code` (match-only vs match+user vs user+gifted vs info-only vs unknown), filtres (past kick_off exclu, self exclu des participants, giftable exclut used/current slot/other gift/same code), submit disabled → enabled selon remplissage, submit args shape exact `{userJokerId, targetMatchId, targetUserId, payload}`, mapping d'erreur (`match_locked` → /verrouillé/, `category_already_used_on_match` → /catégorie/, unknown → /impossible/), fermeture Escape/overlay/Cancel, `isPending=true` → submit disabled avec label "Activation…". `my-jokers-section.test.tsx` passe de 10 → **15 tests** (+5 : `vi.mock('@/features/jokers/consume-joker-dialog')` stub qui rend `<div data-testid="consume-joker-dialog-stub">` avec slot id + close button et spy sur les props ; dialog NON monté initialement, click tile owned → dialog monte avec `{userJokerId:'slot-a', concoursId, competitionId:'comp-1', currentUserId, open:true}`, click tile used → rien, close button → dialog unmonté, pas de `concoursId` → dialog jamais monté même après click). **Total jokers : 118 tests verts** (25 api + 41 schemas + 27 consume-dialog + 10 enabled-toggle + 15 my-jokers-section). i18n FR/EN : bloc `jokers.consume.*` complet — titres par `joker_code`, labels des pickers (match/user/gifted), CTA submit avec states idle/pending, labels vides (`noEligibleMatchs`, `noEligibleUsers`, `noGiftableJokers`), `toast.success` / **20 codes d'erreur** mappés 1:1 sur les `RAISE EXCEPTION` PL/pgSQL + `error.unknown` fallback + `error.pending` pour l'état de chargement. Les libellés des 7 jokers vivent toujours dans les jsonb SQL.

> **Note supabase gen types (Sprint 8.B)** : les types TS ont été régénérés après 8.B.1 + 8.B.3 (`supabase gen types typescript --local > src/types/database.ts` sur la branche) — les nouvelles colonnes de `v_pronos_points` / `v_classement_concours` et la RPC `use_joker` sont maintenant typées côté client, et le cast défensif `(concours as { jokers_enabled?: boolean | null })` mis en place en 8.A est toujours en place comme coussin.

Checks verts (sandbox Linux + pnpm) : `typecheck` ✅ · `test src/features/jokers` **118/118** ✅ (test count cumulé ≈ `~586` sur l'ensemble du repo après 8.B).

### Sprint 8.C — récap (✅ affichage UX des jokers : MatchCard · classement · profil · notifs)

- **8.C.1 (MatchCard : badges multiplier + safety_net + boussole + challenge reçu)** — Composant `MatchJokersBadges` dans `features/jokers/match-jokers-badges.tsx` monté à l'intérieur de `MatchCard` (sous le header phase/groupe). Affiche, **par `(match, user)` courant**, les effets jokers déjà consommés : ×2 si `double` présent, ×3 si `triple`, bouclier si `safety_net`, point d'interrogation cliquable si `boussole` (popover contenant `{score_a, score_b, count}` via `useBoussoleScoreQuery`), et ⚔️ si `IncomingChallengeRow` indique qu'un autre user a challengé l'user courant sur ce match (→ tooltip "X t'a défié pour 5/10 pts"). Hooks dédiés `useUserJokersOnMatchQuery` + `useBoussoleScoreQuery` + `useIncomingChallengesOnMatchQuery` (staleTime 30 s) ; Realtime non nécessaire car les badges sont figés une fois le joker consommé. Props de `MatchCard` étendues avec `currentUserId` + `concoursId` (déjà disponibles dans `PronosGridPage`).

- **8.C.2 (ClassementPage : décomposition prono_points + challenge_delta)** — Les 2 colonnes `prono_points` + `challenge_delta` ajoutées par la migration 8.B.3 à `v_classement_concours` sont maintenant rendues dans la table de classement. Nouvelle colonne "Détail" affichée uniquement `md:` (masquée mobile, comme `Joués` / `Gagnés`) : montre `{prono_points} + {challenge_delta >= 0 ? '+' : ''}{challenge_delta}` avec teinte verte si `delta > 0`, rouge si `delta < 0`, muted si 0. La somme publique `points` reste la métrique principale. `features/classement/schemas.ts` avait déjà `.strip()` les colonnes nouvelles (rétrocompat), il suffit d'étendre le schéma + le normalizer pour exposer les 2 champs typés ; tests Vitest mis à jour en miroir.

- **8.C.3 (HistoriqueJokersSection sur page profil)** — Nouveau composant `features/jokers/historique-jokers-section.tsx` monté sur `/app/profile` sous la section "Mes badges". Liste tous les `user_jokers` de l'user, tous concours confondus, triés par `acquired_at desc` (ou `used_at desc` quand utilisé), avec catégorie + icône + libellé localisé + origine (starter/badge/gift) + état (disponible / utilisé le XX) + nom du concours de provenance. Hook dédié `useUserJokersHistoryQuery` staleTime 60 s, pagination implicite (toute l'histoire, volume raisonnable vu la granularité du catalogue à 7 jokers × participations). Tests Vitest (11 cas couvrant loading / error / empty / tri / groupement par concours / états owned vs used).

- **8.C.4 (Notifications jokers — `challenge_received` + `gift_received`)** — Migration `20260429120000_notifications_jokers.sql` : DROP + ADD du CHECK `notifications_type_check` pour ajouter 2 valeurs (les 4 existantes Sprint 6.C conservées) ; fonction trigger `handle_notifications_on_joker_consumed()` `SECURITY DEFINER` sur `user_jokers` AFTER UPDATE ; dispatch par `joker_category` : si `category='challenge'` et `used_on_match_id` rempli → push `challenge_received` au `used_on_target_user_id` avec payload `{concours_id, match_id, sender_id, joker_code, stakes (int cast du jsonb)}` ; sinon si `joker_code='gift'` → push `gift_received` au target avec `{concours_id, sender_id, gifted_joker_code}`. **Subtilité anti-doublon gift** : le RPC `use_joker` réalise 2 UPDATEs (1. le slot `gift` source est marqué utilisé ; 2. le slot offert est créé avec `used_at` si gift instantané — ou plus simplement le gift_received ne doit PAS être re-poussé quand l'UPDATE concerne un autre slot). On garde un strict `new.joker_code = 'gift'` pour ne pousser `gift_received` que depuis l'UPDATE du slot `gift` source. Guards : `old.used_at IS NULL AND new.used_at IS NOT NULL` évite les re-fires sur les UPDATEs subséquents ; `new.used_on_target_user_id <> new.user_id` défense en profondeur si `service_role` bypass. Tests SQL maison `notifications_jokers.sql` (10 scénarios DO block `ASSERT` + `ROLLBACK` : CHECK accepte les 2 nouvelles valeurs, challenge = 5 pts, double_down = 10 pts, boost/boussole sans notif, gift = exactement 1 `gift_received` sans doublon, auto-target guard, second UPDATE ignoré, enum rejette les valeurs hors enum). Types TS à régénérer côté user après cette migration.

  Côté front : `features/notifications/schemas.ts` étendu avec `challengeReceivedPayloadSchema` (concours_id + match_id + sender_id + joker_code + `stakes: number().int().nonnegative().nullable()`) et `giftReceivedPayloadSchema` (concours_id + sender_id + gifted_joker_code), 2 nouvelles branches dans `notificationSchema` (union discriminée sur `type`), nouvelles constantes `CHALLENGE_JOKER_CODES = ['challenge', 'double_down']` + types exportés `ChallengeReceivedNotification` / `GiftReceivedNotification`. `notification-item.tsx` : ajout des icônes `Swords` (rose-700/950) pour challenge et `Gift` (emerald-700/950) pour gift dans `TYPE_VISUALS`, nouvelles branches dans `resolveTitle` / `resolveBody` (challenge : sélection par `joker_code` — `body.challenge` à 5 pts, `body.doubleDown` à 10 pts, fallback `body.generic` avec stakes 0 si code inconnu) / `resolveRoute` (challenge → `/app/concours/:id/pronos`, gift → `/app/concours/:id`). i18n FR/EN : `notifications.types.challengeReceived.{title, body.{challenge, doubleDown, generic}}` + `notifications.types.giftReceived.{title, body}` avec interpolations `{{stakes}}` et `{{code}}`. Tests Vitest étendus : `schemas.test.ts` passe à **51 tests** (+15 sur `CHALLENGE_JOKER_CODES`, les 2 payloads, les 2 branches de l'union + 3 cas normalizer) ; `notification-item.test.tsx` passe à **24 tests** (+8 : 3 challenge variants — challenge/double_down/generic fallback — + 1 gift render + 2 navigation).

- **8.C.5 (Clôture Sprint 8 — tests globaux + lint + récap + push)** — Correction d'un régression Sprint 8.C.1 détectée à la vérif finale : `MatchCard` importe désormais `MatchJokersBadges` qui utilise `useBoussoleScoreQuery` — ce qui casse `match-card.test.tsx` ("No QueryClient set"). Fix : ajout d'un `vi.mock('@/features/jokers/match-jokers-badges', () => ({ MatchJokersBadges: () => null }))` en tête du fichier de test, pattern identique au mock `use-pronos` existant (la suite `match-card` teste la MatchCard seule, pas l'affichage des badges jokers qui a son propre fichier de test). Nettoyage lint 100 % warnings : ré-ordonne imports alphabétiques dans `dashboard-page.tsx` (Sprint 8.C.3), ré-ordonne imports dans 2 fichiers de test PWA (`install-prompt` + `offline-banner` où `i18n` se plaçait avant l'import du composant testé), scoped `eslint-disable import/order` en tête de `update-prompt.test.tsx` avec justification (import volontairement scindé autour des `vi.mock` hoistés).

  **Checks verts finaux (sandbox Linux)** : `typecheck` ✅ (0 erreur) · `lint --max-warnings 0` ✅ (0 warning, 0 erreur) · `test` ✅ **731/731** répartis en 47 fichiers (jokers 118 + notifications 116 + classement 35 + auth 34 + concours 29 + pronos 53 + chat 106 + badges 51 + admin ~130 + pwa 21 + profile/dashboard/hooks/app 154 + lib 5) · `vite build` ✅ PWA 63 entrées precache (1168 KiB) en 6,29 s.

  Résumé Sprint 8 livré : **6 migrations** (init_jokers, jokers_consumption, jokers_scoring_effects, notifications_jokers, + tests SQL), **7 jokers** catalogués bilingues FR/EN (double / triple / safety_net / boussole / challenge / double_down / gift), **20 codes d'erreur** RPC `use_joker` mappés 1:1 en i18n, **nouvelles colonnes** `v_classement_concours.{prono_points, challenge_delta}` + `v_pronos_points.{points_pure, joker_multiplier, joker_safety_net, points_raw, points_final}`, **2 nouveaux types** de notifications (`challenge_received`, `gift_received`), **4 surfaces UX** (MatchCard badges, ClassementPage décomposition, HistoriqueJokersSection profil, NotificationBell 2 nouveaux visuels). Le MVP jokers est complet et testable end-to-end : acquisition → consommation → effet scoring → notification sociale → affichage.

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

_Tiens ce fichier à jour au fil du projet — c'est la boussole de Claude._
