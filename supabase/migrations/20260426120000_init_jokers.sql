-- =============================================================
--  Sprint 8.A — Jokers (acquisition : catalogue + possessions)
-- =============================================================
--
--  Objectif 8.A : poser le schéma, seeder le catalogue, et brancher
--  les triggers d'acquisition. Le RPC `use_joker` et les effets (boost
--  scoring, challenges, gift, boussole) arrivent en 8.B / 8.C / 8.D.
--
--  Schéma (2 tables + 1 colonne) :
--    - `jokers`     : catalogue immuable (seedé, 7 entrées).
--    - `user_jokers`: possessions. 1 ligne = 1 slot. `used_at = null`
--                     → owned. La colonne `used_at` reste null tant
--                     qu'on n'a pas activé l'usage (8.B).
--    - `concours.jokers_enabled` : opt-in par concours (owner only).
--      Par défaut false → le système reste invisible tant que l'owner
--      ne l'active pas, les concours existants ne changent pas.
--
--  Acquisition : exclusivement via triggers SECURITY DEFINER.
--    - Starter pack (3 jokers : double, boussole, challenge) attribué
--      lors de l'INSERT dans concours_participants si le concours a
--      `jokers_enabled = true`.
--    - Badge-based unlocks : 4 jokers mappés (table jokers_badge_unlocks
--      pas choisie — on préfère une fonction inline pour garder le
--      mapping en un seul endroit, facile à amender via une future
--      migration).
--        rookie             → triple        (volume → boost fort)
--        pronostic_parfait  → safety_net    (skill → boost défensif)
--        groupe_parfait     → double_down   (completude → défi gonflé)
--        host               → gift          (social → cadeau)
--    - Backfill : si l'user a déjà gagné les badges avant opt-in,
--      le trigger participant-insert les propage au moment du join.
--    - Backfill opt-in : si l'owner passe jokers_enabled false→true
--      sur un concours avec des participants déjà inscrits, un trigger
--      concours-update distribue le starter + backfill badges à tous.
--
--  Idempotence : uniques index partiels empêchent les doublons pour
--  les acquisitions starter et badge. `gift` (future 8.D) ne sera pas
--  idempotent (on peut offrir plusieurs exemplaires du même joker).
--
--  RLS :
--    - `jokers` : lecture publique authentifiée.
--    - `user_jokers` : lecture self OU même concours (via is_participant,
--      reprise du pattern user_badges).
--    - INSERT/UPDATE/DELETE : aucune policy client → triggers SECURITY
--      DEFINER exclusivement (côté client, RPC `use_joker` en 8.B).
--
--  Realtime : `user_jokers` est ajouté à la publication
--  `supabase_realtime` pour que le front invalide la liste des jokers
--  possédés dès qu'un trigger vient d'en attribuer un.
--
-- =============================================================

-- =============================================================
--  TABLE jokers (catalogue)
-- =============================================================

create table public.jokers (
  code text primary key,
  category text not null check (category in (
    'boost', 'info', 'challenge', 'social'
  )),
  libelle jsonb not null,
  description jsonb not null,
  icon text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jokers_libelle_has_fr_en check (
    libelle ? 'fr' and libelle ? 'en'
  ),
  constraint jokers_description_has_fr_en check (
    description ? 'fr' and description ? 'en'
  )
);

comment on table public.jokers is
  'Catalogue immuable des jokers (7 entrées seedées). Code = slug stable servant de PK.';
comment on column public.jokers.category is
  'Famille du joker : boost / info / challenge / social';
comment on column public.jokers.libelle is
  'Libellé localisé: {"fr": "...", "en": "..."}';
comment on column public.jokers.description is
  'Description localisée: {"fr": "...", "en": "..."}';
comment on column public.jokers.icon is
  'Nom du composant lucide-react (ex: Flame, Compass, Swords)';

create trigger jokers_set_updated_at
before update on public.jokers
for each row execute function public.set_updated_at();

create index jokers_category_idx on public.jokers(category);
create index jokers_sort_idx on public.jokers(sort_order);

-- =============================================================
--  TABLE user_jokers (possessions)
-- =============================================================

create table public.user_jokers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concours_id uuid not null references public.concours(id) on delete cascade,
  joker_code text not null references public.jokers(code) on delete restrict,
  acquired_from text not null check (acquired_from in ('starter', 'badge', 'gift')),
  acquired_at timestamptz not null default now(),

  -- Usage (inactivé en 8.A — populé en 8.B via RPC use_joker)
  used_at timestamptz,
  used_on_match_id uuid references public.matchs(id) on delete set null,
  used_on_target_user_id uuid references auth.users(id) on delete set null,
  used_payload jsonb,

  constraint user_jokers_used_coherence check (
    -- Non-utilisé : tous les used_* doivent rester null
    (used_at is null
      and used_on_match_id is null
      and used_on_target_user_id is null
      and used_payload is null)
    -- Utilisé : used_at doit être set. Les autres colonnes sont
    -- facultatives selon le type de joker (validé en SQL par la
    -- RPC use_joker en 8.B).
    or (used_at is not null)
  )
);

comment on table public.user_jokers is
  'Possessions de jokers par user. 1 ligne = 1 slot (owned si used_at is null, consommé sinon).';
comment on column public.user_jokers.acquired_from is
  'Origine du slot : starter (pack de départ) / badge (déblocage) / gift (reçu d''un autre joueur).';
comment on column public.user_jokers.used_payload is
  'Résultat de l''usage selon le joker : ex. {"most_common_score":"2-1","count":5} pour Boussole, {"stakes":5} pour Challenge.';

create index user_jokers_user_concours_idx
  on public.user_jokers(user_id, concours_id);

create index user_jokers_user_owned_idx
  on public.user_jokers(user_id, concours_id)
  where used_at is null;

create index user_jokers_concours_match_used_idx
  on public.user_jokers(concours_id, used_on_match_id)
  where used_at is not null;

-- Idempotence : un seul slot 'starter' (ou 'badge') par (user, concours, joker).
-- On laisse la possibilité d'avoir plusieurs 'gift' du même joker (pas d'unique
-- sur acquired_from='gift').
create unique index user_jokers_unique_starter
  on public.user_jokers(user_id, concours_id, joker_code)
  where acquired_from = 'starter';

create unique index user_jokers_unique_badge
  on public.user_jokers(user_id, concours_id, joker_code)
  where acquired_from = 'badge';

-- =============================================================
--  Colonne concours.jokers_enabled (opt-in par concours)
-- =============================================================

alter table public.concours
  add column jokers_enabled boolean not null default false;

comment on column public.concours.jokers_enabled is
  'Opt-in par concours pour le système de jokers/bonus. False par défaut.';

-- =============================================================
--  HELPERS
-- =============================================================

-- Starter pack (codes des jokers donnés à l'inscription).
create or replace function public.jokers_starter_codes()
returns text[]
language sql
immutable
as $$
  select array['double', 'boussole', 'challenge']::text[];
$$;

comment on function public.jokers_starter_codes() is
  'Liste des jokers du starter pack attribué à chaque participant (si jokers_enabled).';

-- Mapping badge → joker. Renvoie null si le badge n'ouvre aucun joker.
create or replace function public.badge_to_joker_code(p_badge_code text)
returns text
language sql
immutable
as $$
  select case p_badge_code
    when 'rookie'             then 'triple'
    when 'pronostic_parfait'  then 'safety_net'
    when 'groupe_parfait'     then 'double_down'
    when 'host'               then 'gift'
    else null
  end;
$$;

comment on function public.badge_to_joker_code(text) is
  'Mapping badge → joker débloqué. Extensible via future migration.';

-- Helper lecture : coupe la récursion RLS si utilisé dans une policy.
create or replace function public.is_concours_jokers_enabled(p_concours_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select jokers_enabled from public.concours where id = p_concours_id),
    false
  );
$$;

comment on function public.is_concours_jokers_enabled(uuid) is
  'Retourne concours.jokers_enabled. SECURITY DEFINER pour être utilisable depuis les triggers et éventuelles policies sans boucler sur la RLS de concours.';

-- Helper idempotent d'attribution (équivalent de award_badge).
create or replace function public.award_joker(
  p_user_id uuid,
  p_concours_id uuid,
  p_joker_code text,
  p_acquired_from text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Pour starter/badge : on dédoublonne à la main (les uniques partiels
  -- protègent en base, mais on évite la levée d'exception).
  if p_acquired_from in ('starter', 'badge') then
    if exists (
      select 1 from public.user_jokers
      where user_id = p_user_id
        and concours_id = p_concours_id
        and joker_code = p_joker_code
        and acquired_from = p_acquired_from
    ) then
      return;
    end if;
  end if;

  insert into public.user_jokers (user_id, concours_id, joker_code, acquired_from)
  values (p_user_id, p_concours_id, p_joker_code, p_acquired_from);
end;
$$;

comment on function public.award_joker(uuid, uuid, text, text) is
  'Attribution idempotente (starter/badge) d''un joker à un user dans un concours.';

-- =============================================================
--  SEED — 7 jokers
-- =============================================================

insert into public.jokers (code, category, libelle, description, icon, sort_order) values
  (
    'double',
    'boost',
    '{"fr":"Double","en":"Double"}'::jsonb,
    '{"fr":"Les points de ce match sont ×2 si ton prono est correct.","en":"Your match points are ×2 if your prediction is correct."}'::jsonb,
    'Flame',
    10
  ),
  (
    'triple',
    'boost',
    '{"fr":"Triple","en":"Triple"}'::jsonb,
    '{"fr":"Les points de ce match sont ×3 si ton prono est correct.","en":"Your match points are ×3 if your prediction is correct."}'::jsonb,
    'Zap',
    20
  ),
  (
    'safety_net',
    'boost',
    '{"fr":"Filet","en":"Safety Net"}'::jsonb,
    '{"fr":"Garantit au moins +1 pt sur ce match, même si ton prono est faux.","en":"Guarantees at least +1 pt on this match, even if your prediction is wrong."}'::jsonb,
    'ShieldCheck',
    30
  ),
  (
    'boussole',
    'info',
    '{"fr":"Boussole","en":"Compass"}'::jsonb,
    '{"fr":"Révèle le score exact le plus fréquent parmi les pronos du concours sur un match donné.","en":"Reveals the most common exact score among the concours predictions for a given match."}'::jsonb,
    'Compass',
    40
  ),
  (
    'challenge',
    'challenge',
    '{"fr":"Défi","en":"Challenge"}'::jsonb,
    '{"fr":"Défie un autre joueur sur un match : 5 pts sont transférés du perdant au gagnant.","en":"Challenge another player on a match: 5 pts transfer from loser to winner."}'::jsonb,
    'Swords',
    50
  ),
  (
    'double_down',
    'challenge',
    '{"fr":"Quitte ou double","en":"Double-down"}'::jsonb,
    '{"fr":"Un défi à enjeu doublé : 10 pts au lieu de 5.","en":"A challenge with double stakes: 10 pts instead of 5."}'::jsonb,
    'Swords',
    60
  ),
  (
    'gift',
    'social',
    '{"fr":"Cadeau","en":"Gift"}'::jsonb,
    '{"fr":"Offre un de tes jokers possédés à un autre joueur du concours.","en":"Give one of your owned jokers to another player in the concours."}'::jsonb,
    'Gift',
    70
  );

-- =============================================================
--  RLS
-- =============================================================

-- ----- jokers : lecture publique pour authentifiés -----
alter table public.jokers enable row level security;

create policy "jokers_select_all"
  on public.jokers
  for select
  to authenticated
  using (true);

-- INSERT/UPDATE/DELETE : service_role uniquement (pas de policy client).

-- ----- user_jokers : lecture self OU même concours -----
alter table public.user_jokers enable row level security;

create policy "user_jokers_select_self_or_same_concours"
  on public.user_jokers
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.concours_participants cp1
      inner join public.concours_participants cp2
        on cp1.concours_id = cp2.concours_id
      where cp1.user_id = auth.uid()
        and cp2.user_id = user_jokers.user_id
        and cp1.concours_id = user_jokers.concours_id
    )
  );

-- INSERT/UPDATE/DELETE : aucune policy client.
-- Toutes les mutations passent par triggers SECURITY DEFINER (8.A) ou
-- RPC use_joker SECURITY DEFINER (8.B).

-- =============================================================
--  TRIGGER 1 — concours_participants INSERT
--  Attribue le starter pack + backfill des badges déjà gagnés.
-- =============================================================

create or replace function public.handle_jokers_on_participant_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_starter_code text;
  v_badge record;
  v_joker_code text;
begin
  -- Guard : concours opt-in uniquement
  if not public.is_concours_jokers_enabled(new.concours_id) then
    return null;
  end if;

  -- Starter pack (double / boussole / challenge)
  foreach v_starter_code in array public.jokers_starter_codes() loop
    perform public.award_joker(new.user_id, new.concours_id, v_starter_code, 'starter');
  end loop;

  -- Backfill : badges déjà gagnés par l'user qui ouvrent un joker
  for v_badge in
    select badge_code
    from public.user_badges
    where user_id = new.user_id
  loop
    v_joker_code := public.badge_to_joker_code(v_badge.badge_code);
    if v_joker_code is not null then
      perform public.award_joker(new.user_id, new.concours_id, v_joker_code, 'badge');
    end if;
  end loop;

  return null;
end;
$$;

create trigger jokers_on_participant_insert
after insert on public.concours_participants
for each row execute function public.handle_jokers_on_participant_insert();

-- =============================================================
--  TRIGGER 2 — user_badges INSERT
--  Propage le déblocage du joker associé dans tous les concours
--  où l'user est participant ET jokers_enabled.
-- =============================================================

create or replace function public.handle_jokers_on_badge_earned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_joker_code text;
  v_cp record;
begin
  v_joker_code := public.badge_to_joker_code(new.badge_code);
  if v_joker_code is null then
    return null;
  end if;

  for v_cp in
    select cp.concours_id
    from public.concours_participants cp
    inner join public.concours c on c.id = cp.concours_id
    where cp.user_id = new.user_id
      and c.jokers_enabled = true
  loop
    perform public.award_joker(new.user_id, v_cp.concours_id, v_joker_code, 'badge');
  end loop;

  return null;
end;
$$;

create trigger jokers_on_badge_earned
after insert on public.user_badges
for each row execute function public.handle_jokers_on_badge_earned();

-- =============================================================
--  TRIGGER 3 — concours UPDATE (jokers_enabled false → true)
--  Quand l'owner active le système sur un concours existant avec des
--  participants déjà inscrits, on leur distribue le starter pack et
--  on backfill les badges unlocks.
-- =============================================================

create or replace function public.handle_jokers_on_concours_enable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cp record;
  v_badge record;
  v_starter_code text;
  v_joker_code text;
begin
  -- Guard : uniquement sur transition false → true
  if new.jokers_enabled is not true
     or coalesce(old.jokers_enabled, false) = true
  then
    return null;
  end if;

  for v_cp in
    select user_id
    from public.concours_participants
    where concours_id = new.id
  loop
    -- Starter pack
    foreach v_starter_code in array public.jokers_starter_codes() loop
      perform public.award_joker(v_cp.user_id, new.id, v_starter_code, 'starter');
    end loop;

    -- Backfill badges
    for v_badge in
      select badge_code
      from public.user_badges
      where user_id = v_cp.user_id
    loop
      v_joker_code := public.badge_to_joker_code(v_badge.badge_code);
      if v_joker_code is not null then
        perform public.award_joker(v_cp.user_id, new.id, v_joker_code, 'badge');
      end if;
    end loop;
  end loop;

  return null;
end;
$$;

create trigger jokers_on_concours_enable
after update on public.concours
for each row execute function public.handle_jokers_on_concours_enable();

-- =============================================================
--  Publication Realtime
-- =============================================================
-- Le front s'abonne aux INSERT sur user_jokers (filtré user_id=eq.me)
-- pour rafraîchir la section "Mes jokers" dès qu'un trigger vient
-- d'en attribuer un nouveau.

alter publication supabase_realtime add table public.user_jokers;
