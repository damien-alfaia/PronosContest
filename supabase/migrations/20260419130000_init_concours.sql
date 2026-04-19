-- =============================================================
--  Sprint 2 — Concours & compétitions
-- =============================================================
--
--  Schéma (4 tables) :
--    - competitions          : source de vérité (FIFA WC 2026, etc.)
--    - equipes               : équipes rattachées à une compétition
--    - concours              : concours privés créés par un user
--    - concours_participants : membres d'un concours
--
--  Règles métier clés :
--    - Visibility : public | private | unlisted
--        public   : listé + join libre
--        private  : non listé, join via code
--        unlisted : non listé, join via code OU via lien direct
--    - Auto-ajout de l'owner dans concours_participants (role 'admin')
--    - Code d'invitation auto-généré si visibility != 'public'
--    - RLS : helper is_participant() en security definer pour éviter
--      la récursion infinie sur la policy SELECT de cp.
--    - Join par code : RPC join_concours_by_code() en security definer.
--
--  scoring_rules en jsonb (flexibilité, voir ADR-0002). Validation
--  stricte en Zod côté front ; côté SQL on se contente d'un
--  jsonb_typeof = 'object'.
--
-- =============================================================

-- ---------- ENUM-LIKE ----------
-- On reste sur des CHECK textuels plutôt que des enums PG :
-- - plus simple à modifier (pas d'ALTER TYPE ADD VALUE)
-- - visibilité dans les types TS générés
-- - alignement avec JSONB et la philosophie Supabase

-- ---------- COMPETITIONS ----------
create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  nom text not null,
  sport text not null check (sport in ('football', 'rugby')),
  date_debut date,
  date_fin date,
  logo_url text,
  status text not null default 'upcoming'
    check (status in ('upcoming', 'live', 'finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competitions_dates_order check (
    date_debut is null or date_fin is null or date_fin >= date_debut
  )
);

comment on table public.competitions is
  'Compétitions sportives (source de vérité, alimentée par seed/admin)';
comment on column public.competitions.code is
  'Slug unique, ex: fifa-wc-2026';

create trigger competitions_set_updated_at
before update on public.competitions
for each row execute function public.set_updated_at();

-- ---------- EQUIPES ----------
create table public.equipes (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  code text not null,
  nom text not null,
  drapeau_url text,
  groupe text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipes_code_per_competition unique (competition_id, code)
);

comment on table public.equipes is
  'Équipes rattachées à une compétition (groupes A-L, codes FIFA 3 lettres)';

create trigger equipes_set_updated_at
before update on public.equipes
for each row execute function public.set_updated_at();

create index equipes_competition_idx on public.equipes(competition_id);

-- ---------- CONCOURS ----------
create table public.concours (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (char_length(nom) between 3 and 80),
  description text check (description is null or char_length(description) <= 500),
  competition_id uuid not null references public.competitions(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete cascade,
  visibility text not null default 'public'
    check (visibility in ('public', 'private', 'unlisted')),
  code_invitation text unique,
  scoring_rules jsonb not null default '{
    "exact_score": 15,
    "correct_winner": 5,
    "correct_draw": 7,
    "odds_multiplier_enabled": true,
    "knockout_bonus": 2
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scoring_rules_is_object check (jsonb_typeof(scoring_rules) = 'object'),
  -- code_invitation requis ssi visibility != 'public'
  constraint code_invitation_when_private check (
    (visibility = 'public' and code_invitation is null)
    or (visibility in ('private', 'unlisted') and code_invitation is not null)
  )
);

comment on table public.concours is
  'Concours privés créés par les users autour d''une compétition';
comment on column public.concours.visibility is
  'public: listé / private: caché, join via code / unlisted: caché, join via code ou lien direct';
comment on column public.concours.scoring_rules is
  'Config de scoring (jsonb). Validée côté front par Zod.';

create trigger concours_set_updated_at
before update on public.concours
for each row execute function public.set_updated_at();

create index concours_owner_idx on public.concours(owner_id);
create index concours_competition_idx on public.concours(competition_id);
create index concours_public_idx on public.concours(visibility) where visibility = 'public';

-- ---------- CONCOURS_PARTICIPANTS ----------
create table public.concours_participants (
  concours_id uuid not null references public.concours(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('member', 'admin')),
  joined_at timestamptz not null default now(),
  primary key (concours_id, user_id)
);

comment on table public.concours_participants is
  'Jonction user <-> concours, avec rôle applicatif (owner = admin auto)';

create index cp_user_idx on public.concours_participants(user_id);

-- =============================================================
--  HELPERS (security definer pour couper la récursion RLS)
-- =============================================================

-- Retourne true si le user courant est participant du concours.
-- SECURITY DEFINER + STABLE : évite la récursion sur la policy SELECT
-- de concours_participants (sinon la sous-requête retrigge la policy).
create or replace function public.is_participant(p_concours_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.concours_participants
    where concours_id = p_concours_id
      and user_id = auth.uid()
  );
$$;

comment on function public.is_participant(uuid) is
  'Helper RLS : true si le user courant est dans concours_participants. SECURITY DEFINER pour éviter la récursion.';

-- Génère un code d'invitation lisible (8 caractères hex en majuscules)
create or replace function public.generate_concours_code()
returns text
language sql
volatile
as $$
  select upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
$$;

-- =============================================================
--  TRIGGERS
-- =============================================================

-- Auto-génération du code d'invitation si visibility != 'public'
create or replace function public.set_concours_code()
returns trigger
language plpgsql
as $$
begin
  if new.visibility in ('private', 'unlisted') and new.code_invitation is null then
    -- 5 essais max en cas de collision (probabilité quasi nulle mais on blinde)
    for i in 1..5 loop
      new.code_invitation := public.generate_concours_code();
      exit when not exists (
        select 1 from public.concours where code_invitation = new.code_invitation
      );
    end loop;
  elsif new.visibility = 'public' then
    new.code_invitation := null;
  end if;
  return new;
end;
$$;

create trigger concours_set_code_before_insert
before insert on public.concours
for each row execute function public.set_concours_code();

-- Si un concours passe public -> private/unlisted, on génère un code.
-- Si il passe à public, on efface le code.
create trigger concours_set_code_before_update
before update on public.concours
for each row
when (old.visibility is distinct from new.visibility)
execute function public.set_concours_code();

-- Auto-ajout de l'owner dans concours_participants (role 'admin')
create or replace function public.handle_new_concours()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.concours_participants (concours_id, user_id, role)
  values (new.id, new.owner_id, 'admin')
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_concours_created
after insert on public.concours
for each row execute function public.handle_new_concours();

-- =============================================================
--  RLS
-- =============================================================

-- ----- competitions : read-only pour les authentifiés -----
alter table public.competitions enable row level security;

create policy "competitions_select_all"
  on public.competitions
  for select
  to authenticated
  using (true);

-- INSERT/UPDATE/DELETE : via service_role uniquement (pas de policy)

-- ----- equipes : read-only pour les authentifiés -----
alter table public.equipes enable row level security;

create policy "equipes_select_all"
  on public.equipes
  for select
  to authenticated
  using (true);

-- ----- concours -----
alter table public.concours enable row level security;

-- SELECT : public OR owner OR participant
-- L'owner a aussi son is_participant = true grâce au trigger, mais on
-- garde la condition owner_id = auth.uid() explicite pour l'intention.
create policy "concours_select_visible"
  on public.concours
  for select
  to authenticated
  using (
    visibility = 'public'
    or owner_id = auth.uid()
    or public.is_participant(id)
  );

-- INSERT : un user ne peut créer un concours qu'à son nom
create policy "concours_insert_own"
  on public.concours
  for insert
  to authenticated
  with check (owner_id = auth.uid());

-- UPDATE : owner uniquement (pas de transfert de propriété côté client)
create policy "concours_update_own"
  on public.concours
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- DELETE : owner uniquement
create policy "concours_delete_own"
  on public.concours
  for delete
  to authenticated
  using (owner_id = auth.uid());

-- ----- concours_participants -----
alter table public.concours_participants enable row level security;

-- SELECT : soi-même OU membre du même concours (pour le classement)
create policy "cp_select_same_concours"
  on public.concours_participants
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_participant(concours_id)
  );

-- INSERT : self-join sur un concours public uniquement
-- (privés/unlisted passent par la RPC join_concours_by_code)
create policy "cp_insert_self_on_public"
  on public.concours_participants
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.concours c
      where c.id = concours_id
        and c.visibility = 'public'
    )
  );

-- DELETE : self-leave (un user peut quitter un concours)
-- Le cas "owner quitte" sera géré en applicatif (transfert ou suppression)
create policy "cp_delete_self"
  on public.concours_participants
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Pas de policy UPDATE : on ne permet pas (pour l'instant) de changer
-- le rôle d'un participant depuis le front.

-- =============================================================
--  RPC : join via code
-- =============================================================

create or replace function public.join_concours_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_concours_id uuid;
  v_visibility text;
begin
  if p_code is null or length(p_code) = 0 then
    raise exception 'code_required' using errcode = 'P0001';
  end if;

  select id, visibility
    into v_concours_id, v_visibility
  from public.concours
  where code_invitation = upper(trim(p_code));

  if v_concours_id is null then
    raise exception 'concours_not_found' using errcode = 'P0001';
  end if;

  if v_visibility not in ('private', 'unlisted') then
    raise exception 'concours_not_joinable' using errcode = 'P0001';
  end if;

  insert into public.concours_participants (concours_id, user_id, role)
  values (v_concours_id, auth.uid(), 'member')
  on conflict do nothing;

  return v_concours_id;
end;
$$;

comment on function public.join_concours_by_code(text) is
  'Rejoint un concours privé/unlisted via son code d''invitation. Idempotent (ON CONFLICT DO NOTHING). Retourne l''id du concours.';

grant execute on function public.join_concours_by_code(text) to authenticated;
