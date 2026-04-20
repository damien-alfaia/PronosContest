# README — Espace Admin (Sprint 5)

Ce document décrit l'espace d'administration ajouté en Sprint 5 :
- **modèle d'autorisation** (rôle global `admin` + RLS Supabase),
- **pages admin** (`/app/admin/*`),
- **invariants SQL** (triggers, FK, RLS) qui encadrent les écritures,
- **mapping d'erreurs** remonté à l'utilisateur sous forme de toasts.

> L'espace admin est réservé aux utilisateurs dont `profiles.role = 'admin'`.
> Les autres utilisateurs authentifiés (`role = 'user'`) n'ont **aucune**
> permission d'écriture sur les tables de référentiel et de matchs.

---

## 1. Modèle d'autorisation

### Rôle global en BDD

`profiles.role` est une colonne `text` avec un CHECK `in ('user', 'admin')`
et un default `'user'`. Elle est mise à jour manuellement (console Supabase
ou seed) — il n'y a **pas** d'UI pour promouvoir un utilisateur.

### Helper SQL `public.is_admin(uuid?)`

Fonction `SECURITY DEFINER STABLE` introduite par la migration
`20260421120000_admin_matchs.sql`. Elle lit `profiles.role` pour
l'utilisateur courant (`auth.uid()`) et renvoie `true` si le rôle est
`admin`. Utilisée par **toutes** les policies RLS admin (matchs,
compétitions, équipes) — un seul point d'autorité, un seul endroit à
patcher si le modèle évolue.

### Guard React `<RequireAdmin />`

`src/features/admin/guards/require-admin.tsx` monte sous `<RequireAuth />`.
Tant que la requête `profiles.role` n'est pas résolue il affiche un spinner
plein écran (évite un flash), puis :
- si non admin → redirect silencieux vers `/app/dashboard`,
- si admin → `<Outlet />` vers la page admin.

Le hook sous-jacent `useIsAdmin()` cache la réponse avec
`staleTime: 5 min` — le rôle ne change quasi jamais en session.

---

## 2. Routes

| Chemin                     | Composant                  | Contenu                                      |
| -------------------------- | -------------------------- | -------------------------------------------- |
| `/app/admin/matchs`        | `AdminMatchsPage`          | CRUD de la fiche match (équipes + résultat) |
| `/app/admin/competitions`  | `AdminCompetitionsPage`    | CRUD du référentiel compétitions             |
| `/app/admin/equipes`       | `AdminEquipesPage`         | CRUD du référentiel équipes                  |

Les 3 routes sont groupées sous `<RequireAuth />` → `<RequireAdmin />`
dans `src/app/providers/router.tsx`.

---

## 3. Page `/app/admin/matchs`

### Fonctionnalités
- **Sélecteur de compétition** (auto-sélection de la 1re compétition
  retournée par `listCompetitions`, triée `date_debut asc`).
- **Filtres** phase (`groupes` / `huitiemes` / `quarts` / `demis` /
  `petite_finale` / `finale`) et status (`scheduled` / `live` /
  `finished` / `postponed` / `cancelled`) côté client — le dataset
  max sur FIFA WC 2026 est 104 matchs.
- **Table** avec badges statut teintés (Clock / CircleDot / CheckCircle2
  / ShieldAlert / XCircle) et actions par ligne via un dropdown :
  - **Saisir / corriger le résultat** → `MatchResultDialog`
  - **Assigner / changer les équipes** → `MatchTeamsDialog`
  - **Changer le statut** (live / postponed / cancelled / scheduled)
    via une mutation rapide
  - **Reset** → remet en `scheduled` + efface `score_a/b`,
    `vainqueur_tab`, `penalty_score_a/b`.

### API (`features/admin/matchs/api.ts`)
- `listAdminMatchsByCompetition(competitionId)` — inclut les jointures
  `equipes!matchs_equipe_a_id_fkey` + `..._equipe_b_id_fkey`.
- `listEquipesForCompetition(competitionId)`.
- `updateMatchTeams({ id, equipe_a_id, equipe_b_id })`.
- `updateMatchResult({ id, input })` — validé par
  `matchResultSchema` (Zod).
- `updateMatchStatus({ id, status })`.
- `resetMatchResult(matchId)`.

### Hooks (`use-admin-matchs.ts`)
Query keys structurées `adminMatchsKeys.*`, mutations avec
invalidation ciblée de la liste concernée à chaque succès.

### Invariants SQL

**Trigger `matchs_prevent_team_change_if_finished`** — bloque toute
écriture sur `equipe_a_id` / `equipe_b_id` d'un match en statut
`finished`. Protège l'historique de scoring (les pronos référencent
`match_id`, l'issue est déjà scellée).

**Équipes nullable** — introduit par la migration admin pour seeder
les 32 placeholders KO (dates / stades connus, équipes NULL tant que
les groupes ne sont pas joués). Le CHECK `matchs_equipes_distinct`
reste actif — `null <> null` → `null` → pass, donc compatible.

**Status étendu** — ajout de `'postponed'` (report officiel) ;
les 4 autres (`scheduled`, `live`, `finished`, `cancelled`) étaient
déjà là depuis Sprint 3.

### Scoring automatique

Aucune action côté front. La vue `v_pronos_points` (Sprint 4) recalcule
les points dès que `matchs.score_a / score_b / status / vainqueur_tab`
change. La vue `v_classement_concours` reflète le résultat en
Realtime (hook `useClassementRealtime`).

---

## 4. Page `/app/admin/competitions`

### Fonctionnalités
- Liste de **toutes** les compétitions (tri `date_debut desc` puis `nom asc`).
- Bouton **"Nouvelle compétition"** → `CompetitionDialog` (création).
- Actions par ligne : **Modifier** / **Supprimer**.
- Suppression confirmée par `window.confirm`.

### Champs éditables (`competitionUpsertSchema`)
- `code` — slug `[a-z0-9-]+` (2..40), unique.
- `nom` — 2..120 caractères.
- `sport` — enum `football` / `rugby`.
- `status` — enum `upcoming` / `live` / `finished`.
- `date_debut` / `date_fin` — `YYYY-MM-DD` (preprocess tolère
  `datetime-local`). CHECK `date_fin >= date_debut` via `superRefine`.
- `logo_url` — URL ou `null`.

### API (`features/admin/competitions/api.ts`)
- `listCompetitionsAdmin()`
- `createCompetition(input)`
- `updateCompetition({ id, input })`
- `deleteCompetition(id)`

### Mapping d'erreurs
| Code Postgres | Origine                                              | Toast                                              |
| ------------- | ---------------------------------------------------- | -------------------------------------------------- |
| `23505`       | UNIQUE `competitions_code` (slug déjà pris)          | `admin.errors.competitionCodeTaken`                |
| `23503`       | FK `concours.competition_id` ou `matchs.competition_id` (RESTRICT) | `admin.errors.competitionInUse` |
| `42501`       | RLS (non admin)                                      | fallback générique                                 |

---

## 5. Page `/app/admin/equipes`

### Fonctionnalités
- **Sélecteur de compétition** (auto-sélection de la 1re).
- Table triée `groupe asc NULLS LAST` puis `nom asc` côté API.
- Colonnes : groupe (badge), code, nom, FIFA id, drapeau (`<img>`).
- Création / édition via `EquipeDialog`.
- Suppression via `window.confirm`.

### Champs éditables (`equipeUpsertSchema`)
- `competition_id` — UUID (NON éditable après création — verrouillé
  par le trigger SQL `equipes_prevent_competition_change`).
- `code` — regex `[A-Z0-9]+` strict, 2..10 caractères (unique par
  compétition via `equipes_code_per_competition`).
- `nom` — 2..80 caractères.
- `groupe` — preprocess : uppercase + trim + `""` → `null`. Regex
  une lettre `[A-Z]` ou null.
- `drapeau_url` — URL ou null (preprocess `""` → `null`).
- `fifa_id` — preprocess `""` → `null`, string numérique → number.
  Int positif (≥ 1) ou null.

### API (`features/admin/equipes/api.ts`)
- `listEquipesAdmin(competitionId)`
- `createEquipe(input)` — payload complet (avec `competition_id`).
- `updateEquipe({ id, input })` — **n'envoie PAS** `competition_id`
  (double sécurité : trigger SQL + filtrage client).
- `deleteEquipe(id)`.

### Invariants SQL

**Trigger `equipes_prevent_competition_change`** — bloque toute
tentative de déplacer une équipe d'une compétition à une autre.
Renommer ou changer le code d'une équipe reste libre.

**FK existantes**
- `matchs.equipe_a_id` / `equipe_b_id → equipes.id ON DELETE RESTRICT` :
  impossible de supprimer une équipe référencée par un match.
- `equipes.competition_id → competitions.id ON DELETE CASCADE` : si
  une compétition est supprimée (sans concours ni matchs), ses équipes
  partent avec.

### Mapping d'erreurs
| Code Postgres | Origine                                          | Toast                              |
| ------------- | ------------------------------------------------ | ---------------------------------- |
| `23505`       | UNIQUE `equipes_code_per_competition`            | `admin.errors.teamCodeTaken`       |
| `23503`       | FK `matchs.equipe_a_id / equipe_b_id` (RESTRICT) | `admin.errors.teamInUse`           |
| trigger       | `equipes_prevent_competition_change`             | `admin.errors.teamCompetitionLocked` |

---

## 6. Tests

Chaque page admin est couverte par 3 fichiers Vitest :
- `__tests__/schemas.test.ts` — règles Zod (preprocess, regex, bornes,
  messages i18n).
- `__tests__/api.test.ts` — builder Supabase mocké, assertions sur
  `from` / `insert` / `update` / `eq` / `order`, propagation
  des erreurs RLS / FK / UNIQUE.
- `__tests__/<page>.test.tsx` — rendu page + interactions (confirm,
  mutate, toasts, dialog), avec `vi.hoisted()` pour partager l'état
  mock entre `vi.mock` et le test (contourne le TDZ dû au hoisting
  de `vi.mock`).

Total Sprint 5 : **~130 tests admin** ajoutés (matchs + competitions +
equipes), intégrés à la suite globale `pnpm test`.

---

## 7. i18n

Toutes les chaînes admin vivent sous `admin.*` dans `public/locales/{fr,en}/translation.json` :
- `admin.matchs.*` / `admin.competitions.*` / `admin.equipes.*`
- `admin.toast.*` (messages de succès)
- `admin.errors.*` (mapping codes Postgres)

---

## 8. Checklist de promotion d'un utilisateur en admin

1. Se connecter à la console Supabase (ou `psql` local).
2. `update public.profiles set role = 'admin' where id = '<uuid>';`
3. L'utilisateur doit recharger l'app (ou attendre ~5 min que le cache
   `useIsAdmin` expire) pour voir les entrées de menu admin.

Aucune UI n'expose cette action — c'est volontaire : on protège le
rôle `admin` derrière un accès BDD direct.
