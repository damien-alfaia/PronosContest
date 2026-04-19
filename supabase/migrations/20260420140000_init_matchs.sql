-- =============================================================
--  Sprint 3 — Matchs & pronos
-- =============================================================
--
--  Schéma (2 tables) :
--    - matchs                : matchs d'une compétition (planifiés
--                              par seed/import API en Sprint 5)
--    - pronos                : pronostic d'un user dans un concours
--                              pour un match donné
--
--  Règles métier clés :
--    - Verrouillage au coup d'envoi : `kick_off_at`. Aucune
--      saisie / modif / suppression n'est possible une fois
--      `now() >= kick_off_at`.
--    - Visibilité des pronos :
--        - L'utilisateur voit toujours ses propres pronos.
--        - Les pronos des autres participants d'un même concours
--          sont visibles UNIQUEMENT après le coup d'envoi.
--    - vainqueur_tab : sert à départager un match KO terminé sur
--      égalité (utile pour scoring + affichage). Pas applicable
--      en phase de groupes (égalité autorisée).
--
--  Convention :
--    On reste sur des CHECK textuels (alignement avec Sprint 2
--    et migrations profiles, pas d'ALTER TYPE ADD VALUE pénible).
--
--  Mapping FIFA :
--    - equipes.fifa_id  : squadId du JSON officiel FIFA
--    - matchs.fifa_match_id : id du JSON FIFA (utile pour
--      l'idempotence d'un re-seed et pour matcher les imports
--      API en Sprint 5).
--
-- =============================================================

-- ---------- Ajout fifa_id sur equipes ----------
-- Mapping vers le squadId officiel FIFA (1..48 pour la WC 2026).
-- Unique par compétition pour éviter les collisions cross-tournoi.
alter table public.equipes
  add column fifa_id smallint;

create unique index equipes_fifa_id_per_competition_idx
  on public.equipes(competition_id, fifa_id)
  where fifa_id is not null;

comment on column public.equipes.fifa_id is
  'squadId officiel FIFA (utile pour matcher les imports API et le seed)';

-- ---------- MATCHS ----------
create table public.matchs (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,

  -- Mapping import (idempotence d'un re-seed et matching API)
  fifa_match_id smallint,

  -- Phase + numéro de journée (J1/J2/J3 en phase de groupes)
  phase text not null
    check (phase in ('groupes', 'seiziemes', 'huitiemes', 'quarts', 'demis', 'petite_finale', 'finale')),
  round smallint check (round is null or round between 1 and 10),

  kick_off_at timestamptz not null,
  venue_name text,

  equipe_a_id uuid not null references public.equipes(id) on delete restrict,
  equipe_b_id uuid not null references public.equipes(id) on delete restrict,

  -- Score à la fin du temps réglementaire (90 min) ou prolongations
  -- pour un match KO.
  score_a smallint check (score_a is null or score_a between 0 and 99),
  score_b smallint check (score_b is null or score_b between 0 and 99),

  -- Vainqueur en cas d'égalité au temps règlementaire (TAB ou
  -- prolongations). Uniquement pour les matchs KO.
  vainqueur_tab char(1) check (vainqueur_tab is null or vainqueur_tab in ('a', 'b')),

  -- Score des tirs au but (pour stockage des résultats officiels)
  penalty_score_a smallint check (penalty_score_a is null or penalty_score_a between 0 and 30),
  penalty_score_b smallint check (penalty_score_b is null or penalty_score_b between 0 and 30),

  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'finished', 'cancelled')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Un match ne peut pas opposer une équipe à elle-même
  constraint matchs_equipes_distinct check (equipe_a_id <> equipe_b_id),

  -- vainqueur_tab uniquement applicable si égalité ET match KO
  constraint matchs_vainqueur_tab_only_ko_draw check (
    vainqueur_tab is null
    or (phase <> 'groupes' and score_a is not null and score_b is not null and score_a = score_b)
  ),

  -- Idempotence d'un re-seed depuis FIFA
  constraint matchs_fifa_match_id_per_competition unique (competition_id, fifa_match_id)
);

comment on table public.matchs is
  'Matchs d''une compétition (phase de groupes seedée, KO créés au fil de l''eau)';
comment on column public.matchs.kick_off_at is
  'Coup d''envoi en UTC. Sert de verrou : pronos figés dès now() >= kick_off_at.';
comment on column public.matchs.vainqueur_tab is
  'Vainqueur en cas d''égalité au temps règlementaire sur un match KO ("a" ou "b")';

create trigger matchs_set_updated_at
before update on public.matchs
for each row execute function public.set_updated_at();

create index matchs_competition_idx on public.matchs(competition_id);
create index matchs_kickoff_idx on public.matchs(kick_off_at);
create index matchs_phase_idx on public.matchs(competition_id, phase);

-- ---------- PRONOS ----------
create table public.pronos (
  concours_id uuid not null references public.concours(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references public.matchs(id) on delete cascade,

  score_a smallint not null check (score_a between 0 and 99),
  score_b smallint not null check (score_b between 0 and 99),

  -- Optionnel : vainqueur en cas d'égalité (KO uniquement, validé
  -- côté Zod selon la phase du match référencé).
  vainqueur_tab char(1) check (vainqueur_tab is null or vainqueur_tab in ('a', 'b')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (concours_id, user_id, match_id),

  -- vainqueur_tab uniquement si égalité (la phase est validée Zod)
  constraint pronos_vainqueur_tab_only_on_draw check (
    vainqueur_tab is null or score_a = score_b
  )
);

comment on table public.pronos is
  'Pronos d''un user dans un concours pour un match (PK composite)';

create trigger pronos_set_updated_at
before update on public.pronos
for each row execute function public.set_updated_at();

create index pronos_user_idx on public.pronos(user_id);
create index pronos_match_idx on public.pronos(match_id);
create index pronos_concours_user_idx on public.pronos(concours_id, user_id);

-- =============================================================
--  HELPERS (security definer pour bénéficier des index sans RLS)
-- =============================================================

-- Retourne true si le match est verrouillé (kick_off passé).
-- STABLE car now() est stable au sein d'une transaction.
create or replace function public.is_match_locked(p_match_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.matchs
    where id = p_match_id
      and now() >= kick_off_at
  );
$$;

comment on function public.is_match_locked(uuid) is
  'Helper RLS : true si now() >= matchs.kick_off_at. SECURITY DEFINER pour ne pas dépendre de la RLS de matchs.';

-- =============================================================
--  RLS
-- =============================================================

-- ----- matchs : read-only pour les authentifiés -----
alter table public.matchs enable row level security;

create policy "matchs_select_all"
  on public.matchs
  for select
  to authenticated
  using (true);

-- INSERT/UPDATE/DELETE : via service_role uniquement
-- (admin / import API en Sprint 5)

-- ----- pronos -----
alter table public.pronos enable row level security;

-- SELECT : soi-même OU (participant du même concours ET match verrouillé)
create policy "pronos_select_self_or_locked"
  on public.pronos
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or (public.is_participant(concours_id) and public.is_match_locked(match_id))
  );

-- INSERT : self uniquement, doit être participant, match non verrouillé
create policy "pronos_insert_self_unlocked"
  on public.pronos
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_participant(concours_id)
    and not public.is_match_locked(match_id)
  );

-- UPDATE : self uniquement, match toujours non verrouillé
-- (USING : voir les lignes existantes ; WITH CHECK : valider les nouvelles)
create policy "pronos_update_self_unlocked"
  on public.pronos
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and not public.is_match_locked(match_id)
  )
  with check (
    user_id = auth.uid()
    and public.is_participant(concours_id)
    and not public.is_match_locked(match_id)
  );

-- DELETE : self uniquement, match non verrouillé
create policy "pronos_delete_self_unlocked"
  on public.pronos
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and not public.is_match_locked(match_id)
  );
