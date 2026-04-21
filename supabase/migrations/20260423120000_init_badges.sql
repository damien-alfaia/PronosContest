-- =============================================================
--  Sprint 6.A — Badges (gamification)
-- =============================================================
--
--  Schéma (2 tables) :
--    - badges       : catalogue immuable (seedé). code = pk lisible.
--    - user_badges  : attribution user -> badge, PK (user_id, badge_code),
--                     idempotent via ON CONFLICT DO NOTHING.
--
--  Attribution : exclusivement côté SQL via triggers SECURITY DEFINER
--  attachés à 4 tables sources (pronos, concours_participants, concours,
--  matchs, competitions). Aucune policy INSERT côté client.
--
--  Events couverts :
--    - pronos INSERT               → first_prono, rookie, veteran,
--                                    night_owl, early_bird, last_second,
--                                    weekend_warrior, groupe_parfait, finisher
--    - concours_participants INSERT → first_concours_join,
--                                     social_butterfly, viral
--    - concours INSERT              → concours_owner, host
--    - matchs UPDATE → finished     → pronostic_parfait, sniper, prophete,
--                                     centurion, streak_5, double_digit,
--                                     cold_blooded, upset_caller, tab_master,
--                                     bonus_hunter, leader, oracle
--    - competitions UPDATE → finished → podium, champion
--
--  Horaires (night_owl / early_bird / weekend_warrior) : basés sur UTC
--  serveur (created_at). Simple, cohérent, indépendant du fuseau user.
--
--  i18n : libelle et description sont stockés en jsonb `{fr, en}` pour
--  permettre le rendu localisé sans round-trip supplémentaire.
--
-- =============================================================

-- ---------- BADGES (catalogue) ----------
create table public.badges (
  code text primary key,
  category text not null check (category in (
    'lifecycle', 'volume', 'skill', 'regularity', 'completude',
    'classement', 'social', 'fun', 'temporal', 'legendary'
  )),
  tier text not null check (tier in ('bronze', 'silver', 'gold', 'legendary')),
  libelle jsonb not null,
  description jsonb not null,
  icon text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint badges_libelle_has_fr_en check (
    libelle ? 'fr' and libelle ? 'en'
  ),
  constraint badges_description_has_fr_en check (
    description ? 'fr' and description ? 'en'
  )
);

comment on table public.badges is
  'Catalogue immuable des badges. Code = slug stable servant de PK.';
comment on column public.badges.libelle is
  'Libellé localisé: {"fr": "...", "en": "..."}';
comment on column public.badges.description is
  'Description localisée: {"fr": "...", "en": "..."}';
comment on column public.badges.icon is
  'Nom du composant lucide-react (ex: Trophy, Flame, Crown)';

create trigger badges_set_updated_at
before update on public.badges
for each row execute function public.set_updated_at();

create index badges_category_idx on public.badges(category);
create index badges_sort_idx on public.badges(sort_order);

-- ---------- USER_BADGES (attribution) ----------
create table public.user_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_code text not null references public.badges(code) on delete cascade,
  earned_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key (user_id, badge_code),
  constraint user_badges_metadata_is_object check (
    jsonb_typeof(metadata) = 'object'
  )
);

comment on table public.user_badges is
  'Attribution d''un badge à un user. Idempotent via ON CONFLICT DO NOTHING.';
comment on column public.user_badges.metadata is
  'Contexte du gain: {"concours_id":"...","match_id":"..."} (facultatif)';

create index user_badges_user_idx on public.user_badges(user_id);
create index user_badges_code_idx on public.user_badges(badge_code);

-- =============================================================
--  RLS
-- =============================================================

-- ----- badges : lecture publique pour authentifiés -----
alter table public.badges enable row level security;

create policy "badges_select_all"
  on public.badges
  for select
  to authenticated
  using (true);

-- INSERT/UPDATE/DELETE : service_role uniquement (pas de policy)

-- ----- user_badges : lecture self OU même concours -----
alter table public.user_badges enable row level security;

create policy "user_badges_select_self_or_same_concours"
  on public.user_badges
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
        and cp2.user_id = user_badges.user_id
    )
  );

-- INSERT/UPDATE/DELETE : aucune policy client -> triggers SECURITY DEFINER uniquement

-- =============================================================
--  SEED — 28 badges
-- =============================================================

insert into public.badges (code, category, tier, libelle, description, icon, sort_order) values

-- ---- Lifecycle (3) ----
('first_prono',         'lifecycle',  'bronze',   '{"fr":"Premier prono","en":"First prono"}'::jsonb,                 '{"fr":"Tu as saisi ton tout premier pronostic.","en":"You made your first prediction."}'::jsonb, 'Sparkles',    10),
('first_concours_join', 'lifecycle',  'bronze',   '{"fr":"Première inscription","en":"First join"}'::jsonb,           '{"fr":"Tu as rejoint ton premier concours.","en":"You joined your first contest."}'::jsonb,     'UserPlus',    11),
('concours_owner',      'lifecycle',  'bronze',   '{"fr":"Organisateur","en":"Host"}'::jsonb,                         '{"fr":"Tu as créé ton premier concours.","en":"You created your first contest."}'::jsonb,       'ClipboardList', 12),

-- ---- Volume (3) ----
('rookie',              'volume',     'bronze',   '{"fr":"Recrue","en":"Rookie"}'::jsonb,                             '{"fr":"25 pronostics saisis.","en":"25 predictions made."}'::jsonb,                             'Footprints',  20),
('veteran',             'volume',     'silver',   '{"fr":"Vétéran","en":"Veteran"}'::jsonb,                           '{"fr":"100 pronostics saisis.","en":"100 predictions made."}'::jsonb,                           'ShieldCheck', 21),
('centurion',           'volume',     'gold',     '{"fr":"Centurion","en":"Centurion"}'::jsonb,                       '{"fr":"50 pronostics corrects.","en":"50 correct predictions."}'::jsonb,                        'Swords',      22),

-- ---- Skill (7) ----
('pronostic_parfait',   'skill',      'silver',   '{"fr":"Pronostic parfait","en":"Perfect prediction"}'::jsonb,      '{"fr":"Tu as trouvé le score exact d''un match.","en":"You nailed the exact score of a match."}'::jsonb, 'Target',   30),
('sniper',              'skill',      'gold',     '{"fr":"Sniper","en":"Sniper"}'::jsonb,                             '{"fr":"5 scores exacts au total.","en":"5 exact scores total."}'::jsonb,                        'Crosshair',   31),
('prophete',            'skill',      'legendary','{"fr":"Prophète","en":"Prophet"}'::jsonb,                          '{"fr":"10 scores exacts au total.","en":"10 exact scores total."}'::jsonb,                      'Eye',         32),
('double_digit',        'skill',      'silver',   '{"fr":"Score de feu","en":"High-scoring"}'::jsonb,                 '{"fr":"Score exact sur un match à ≥ 4 buts.","en":"Exact score on a 4+ goal match."}'::jsonb,  'Flame',       33),
('cold_blooded',        'skill',      'gold',     '{"fr":"Sang-froid","en":"Cold blooded"}'::jsonb,                   '{"fr":"Tu as prédit un 0-0. Respect.","en":"You called a 0-0. Respect."}'::jsonb,               'Snowflake',   34),
('upset_caller',        'skill',      'gold',     '{"fr":"Flair","en":"Upset caller"}'::jsonb,                        '{"fr":"Bon résultat sur une cote ≥ 3.0.","en":"Correct bet on 3.0+ odds."}'::jsonb,             'TrendingUp',  35),
('bonus_hunter',        'skill',      'silver',   '{"fr":"Chasseur de bonus","en":"Bonus hunter"}'::jsonb,            '{"fr":"3 pronostics corrects en phase finale.","en":"3 correct predictions in KO stage."}'::jsonb, 'Gem',       36),

-- ---- Regularity (1) ----
('streak_5',            'regularity', 'silver',   '{"fr":"Série en cours","en":"On a roll"}'::jsonb,                  '{"fr":"5 pronostics corrects d''affilée dans un concours.","en":"5 correct predictions in a row."}'::jsonb, 'Zap',   40),

-- ---- Completude (2) ----
('groupe_parfait',      'completude', 'gold',     '{"fr":"Poule complète","en":"Full group"}'::jsonb,                 '{"fr":"Pronostics saisis sur les 6 matchs d''une poule.","en":"Predictions on all 6 matches of a group."}'::jsonb, 'LayoutGrid', 50),
('finisher',            'completude', 'silver',   '{"fr":"Complétiste","en":"Finisher"}'::jsonb,                      '{"fr":"Pronostics saisis sur 100% des matchs d''une compétition.","en":"Predictions on 100% of matches."}'::jsonb, 'CheckSquare', 51),

-- ---- Classement (3) ----
('leader',              'classement', 'silver',   '{"fr":"Leader","en":"Leader"}'::jsonb,                             '{"fr":"Rang 1 d''un concours (≥ 10 matchs finis).","en":"Rank 1 in a contest (10+ finished matches)."}'::jsonb, 'Flag',    60),
('podium',              'classement', 'gold',     '{"fr":"Podium","en":"Podium"}'::jsonb,                             '{"fr":"Top 3 final d''un concours (≥ 3 participants).","en":"Final top 3 of a contest (3+ participants)."}'::jsonb, 'Medal', 61),
('champion',            'classement', 'legendary','{"fr":"Champion","en":"Champion"}'::jsonb,                         '{"fr":"Vainqueur final d''un concours (≥ 3 participants).","en":"Final winner of a contest (3+ participants)."}'::jsonb, 'Crown', 62),

-- ---- Social (3) ----
('social_butterfly',    'social',     'silver',   '{"fr":"Papillon social","en":"Social butterfly"}'::jsonb,          '{"fr":"Membre de 3 concours en même temps.","en":"Member of 3 contests at once."}'::jsonb,      'Users',       70),
('host',                'social',     'gold',     '{"fr":"Grand organisateur","en":"Super host"}'::jsonb,             '{"fr":"Tu as créé 3 concours.","en":"You created 3 contests."}'::jsonb,                          'CalendarRange', 71),
('viral',               'social',     'silver',   '{"fr":"Viral","en":"Viral"}'::jsonb,                               '{"fr":"3 personnes ont rejoint ton concours via ton code.","en":"3 people joined your contest via your code."}'::jsonb, 'Share2', 72),

-- ---- Fun (2) ----
('night_owl',           'fun',        'bronze',   '{"fr":"Oiseau de nuit","en":"Night owl"}'::jsonb,                  '{"fr":"Prono saisi entre 00h et 5h (UTC).","en":"Prediction made between midnight and 5am (UTC)."}'::jsonb, 'Moon',   80),
('early_bird',          'fun',        'bronze',   '{"fr":"Lève-tôt","en":"Early bird"}'::jsonb,                       '{"fr":"Prono saisi entre 5h et 8h (UTC).","en":"Prediction made between 5am and 8am (UTC)."}'::jsonb, 'Sunrise',  81),

-- ---- Temporal (2) ----
('last_second',         'temporal',   'silver',   '{"fr":"Dernière seconde","en":"Last second"}'::jsonb,              '{"fr":"Prono saisi moins de 5 min avant le coup d''envoi.","en":"Prediction made less than 5 min before kickoff."}'::jsonb, 'AlarmClock', 90),
('weekend_warrior',     'temporal',   'bronze',   '{"fr":"Guerrier du week-end","en":"Weekend warrior"}'::jsonb,      '{"fr":"Prono saisi un samedi ou dimanche.","en":"Prediction made on a weekend."}'::jsonb,       'Beer',        91),

-- ---- Legendary (2 — dont tab_master placé ici car très rare) ----
('tab_master',          'legendary',  'silver',   '{"fr":"Maître des TAB","en":"Penalty king"}'::jsonb,               '{"fr":"Vainqueur aux TAB correctement pronostiqué sur un KO.","en":"Correct penalty shootout winner on a KO match."}'::jsonb, 'CircleDot', 100),
('oracle',              'legendary',  'legendary','{"fr":"Oracle","en":"Oracle"}'::jsonb,                             '{"fr":"Vainqueur correct sur les 6 matchs d''une poule.","en":"Correct winner on all 6 matches of a group."}'::jsonb, 'Gem',      101);

-- =============================================================
--  HELPER : attribution idempotente
-- =============================================================

create or replace function public.award_badge(
  p_user_id uuid,
  p_badge_code text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.user_badges (user_id, badge_code, metadata)
  values (p_user_id, p_badge_code, coalesce(p_metadata, '{}'::jsonb))
  on conflict (user_id, badge_code) do nothing;
$$;

comment on function public.award_badge(uuid, text, jsonb) is
  'Attribution idempotente d''un badge. ON CONFLICT DO NOTHING : appels multiples sans effet.';

-- =============================================================
--  TRIGGERS attachés à `pronos` (AFTER INSERT)
-- =============================================================
--
--  Badges traités ici (se déclenchent à chaque nouveau prono) :
--    - first_prono     : 1er prono de l'user
--    - rookie          : 25 pronos cumul
--    - veteran         : 100 pronos cumul
--    - night_owl       : prono entre 00h-05h UTC
--    - early_bird      : prono entre 05h-08h UTC
--    - weekend_warrior : prono un samedi/dimanche UTC
--    - last_second     : prono < 5 min avant kick_off_at
--    - groupe_parfait  : user a saisi les 6 matchs d'une poule dans ce concours
--    - finisher        : user a saisi 100% des matchs de la compétition dans ce concours

create or replace function public.handle_badges_on_prono_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_match record;
  v_group_count int;
  v_group_total int;
  v_matchs_total int;
  v_pronos_done int;
  v_created_hour int;
  v_created_dow int;
begin
  -- Charger le match (phase, kick_off_at, competition_id) pour éviter les joins en cascade
  select m.kick_off_at, m.phase, m.competition_id, e.groupe
    into v_match
  from public.matchs m
  left join public.equipes e on e.id = m.equipe_a_id
  where m.id = new.match_id;

  -- first_prono : 1er prono de l'user (tous concours confondus)
  -- NB : AFTER ROW trigger sur INSERT multi-lignes → toutes les lignes
  -- sont visibles avant que le 1er trigger ne fire. On utilise donc
  -- des comparaisons `>=` (idempotence assurée par ON CONFLICT DO NOTHING).
  select count(*) into v_total
  from public.pronos
  where user_id = new.user_id;

  if v_total >= 1 then
    perform public.award_badge(new.user_id, 'first_prono',
      jsonb_build_object('concours_id', new.concours_id, 'match_id', new.match_id));
  end if;

  -- rookie : 25 pronos cumul
  if v_total >= 25 then
    perform public.award_badge(new.user_id, 'rookie',
      jsonb_build_object('concours_id', new.concours_id));
  end if;

  -- veteran : 100 pronos cumul
  if v_total >= 100 then
    perform public.award_badge(new.user_id, 'veteran',
      jsonb_build_object('concours_id', new.concours_id));
  end if;

  -- night_owl : 00h-05h UTC (hour 0..4)
  v_created_hour := extract(hour from new.created_at at time zone 'UTC')::int;
  if v_created_hour between 0 and 4 then
    perform public.award_badge(new.user_id, 'night_owl',
      jsonb_build_object('concours_id', new.concours_id, 'match_id', new.match_id));
  end if;

  -- early_bird : 05h-08h UTC (hour 5..7)
  if v_created_hour between 5 and 7 then
    perform public.award_badge(new.user_id, 'early_bird',
      jsonb_build_object('concours_id', new.concours_id, 'match_id', new.match_id));
  end if;

  -- weekend_warrior : samedi (6) ou dimanche (0)
  v_created_dow := extract(dow from new.created_at at time zone 'UTC')::int;
  if v_created_dow in (0, 6) then
    perform public.award_badge(new.user_id, 'weekend_warrior',
      jsonb_build_object('concours_id', new.concours_id));
  end if;

  -- last_second : prono saisi < 5 min avant kick_off_at
  if v_match.kick_off_at is not null
     and new.created_at >= v_match.kick_off_at - interval '5 minutes'
     and new.created_at < v_match.kick_off_at
  then
    perform public.award_badge(new.user_id, 'last_second',
      jsonb_build_object('concours_id', new.concours_id, 'match_id', new.match_id));
  end if;

  -- groupe_parfait : 6 pronos saisis dans ce concours sur des matchs de la même poule
  if v_match.groupe is not null and v_match.phase = 'groupes' then
    select count(distinct p.match_id)
      into v_group_count
    from public.pronos p
    inner join public.matchs m on m.id = p.match_id
    inner join public.equipes e on e.id = m.equipe_a_id
    where p.user_id = new.user_id
      and p.concours_id = new.concours_id
      and m.competition_id = v_match.competition_id
      and e.groupe = v_match.groupe;

    select count(*) into v_group_total
    from public.matchs m
    inner join public.equipes e on e.id = m.equipe_a_id
    where m.competition_id = v_match.competition_id
      and e.groupe = v_match.groupe
      and m.phase = 'groupes';

    if v_group_count >= v_group_total and v_group_total > 0 then
      perform public.award_badge(new.user_id, 'groupe_parfait',
        jsonb_build_object(
          'concours_id', new.concours_id,
          'competition_id', v_match.competition_id,
          'groupe', v_match.groupe
        ));
    end if;
  end if;

  -- finisher : 100% des matchs de la compétition pronostiqués dans ce concours
  select count(*) into v_matchs_total
  from public.matchs
  where competition_id = v_match.competition_id;

  select count(distinct match_id) into v_pronos_done
  from public.pronos p
  inner join public.matchs m on m.id = p.match_id
  where p.user_id = new.user_id
    and p.concours_id = new.concours_id
    and m.competition_id = v_match.competition_id;

  if v_pronos_done >= v_matchs_total and v_matchs_total > 0 then
    perform public.award_badge(new.user_id, 'finisher',
      jsonb_build_object(
        'concours_id', new.concours_id,
        'competition_id', v_match.competition_id
      ));
  end if;

  return null; -- AFTER trigger : valeur ignorée
end;
$$;

create trigger badges_on_prono_insert
after insert on public.pronos
for each row execute function public.handle_badges_on_prono_insert();

-- =============================================================
--  TRIGGERS attachés à `concours_participants` (AFTER INSERT)
-- =============================================================
--
--  Badges traités :
--    - first_concours_join : 1er concours rejoint par l'user
--    - social_butterfly    : membre de 3 concours simultanément
--    - viral               : 3 autres personnes ont rejoint un de MES concours via mon code
--
--  NB : le trigger handle_new_concours() (Sprint 2) ajoute automatiquement
--  l'owner comme 'admin' dans cp. first_concours_join et social_butterfly
--  s'appliquent donc aussi à l'owner (cohérent : créer un concours, c'est
--  aussi le rejoindre). viral ne concerne que l'owner via le join des autres.

create or replace function public.handle_badges_on_participant_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cp_count int;
  v_owner_id uuid;
  v_visibility text;
  v_viral_count int;
begin
  -- first_concours_join : 1er concours rejoint
  -- NB : on utilise `>=` car un INSERT multi-lignes sur cp pourrait
  -- faire passer v_cp_count de 0 à N > 1 en une passe (idempotence OK).
  select count(*) into v_cp_count
  from public.concours_participants
  where user_id = new.user_id;

  if v_cp_count >= 1 then
    perform public.award_badge(new.user_id, 'first_concours_join',
      jsonb_build_object('concours_id', new.concours_id));
  end if;

  -- social_butterfly : membre de 3 concours simultanément
  if v_cp_count >= 3 then
    perform public.award_badge(new.user_id, 'social_butterfly',
      jsonb_build_object('concours_id', new.concours_id));
  end if;

  -- viral : l'owner du concours rejoint gagne si >= 3 autres personnes
  -- ont rejoint via son code (visibility private / unlisted).
  -- On ne récompense pas l'auto-join de l'owner.
  select owner_id, visibility
    into v_owner_id, v_visibility
  from public.concours
  where id = new.concours_id;

  if v_owner_id is not null
     and v_owner_id <> new.user_id
     and v_visibility in ('private', 'unlisted')
  then
    -- Compte les autres participants (hors owner) du concours
    select count(*) into v_viral_count
    from public.concours_participants
    where concours_id = new.concours_id
      and user_id <> v_owner_id;

    if v_viral_count >= 3 then
      perform public.award_badge(v_owner_id, 'viral',
        jsonb_build_object('concours_id', new.concours_id));
    end if;
  end if;

  return null;
end;
$$;

create trigger badges_on_participant_insert
after insert on public.concours_participants
for each row execute function public.handle_badges_on_participant_insert();

-- =============================================================
--  TRIGGERS attachés à `concours` (AFTER INSERT)
-- =============================================================
--
--  Badges traités :
--    - concours_owner : 1er concours créé
--    - host           : 3 concours créés

create or replace function public.handle_badges_on_concours_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owned_count int;
begin
  select count(*) into v_owned_count
  from public.concours
  where owner_id = new.owner_id;

  -- NB: on utilise `>=` plutôt que `=` pour rester robuste aux INSERT
  -- multi-lignes (AFTER ROW trigger voit toutes les nouvelles lignes
  -- déjà visibles). `award_badge` est idempotent via ON CONFLICT DO NOTHING.
  if v_owned_count >= 1 then
    perform public.award_badge(new.owner_id, 'concours_owner',
      jsonb_build_object('concours_id', new.id));
  end if;

  if v_owned_count >= 3 then
    perform public.award_badge(new.owner_id, 'host',
      jsonb_build_object('concours_id', new.id));
  end if;

  return null;
end;
$$;

create trigger badges_on_concours_insert
after insert on public.concours
for each row execute function public.handle_badges_on_concours_insert();

-- =============================================================
--  TRIGGERS attachés à `matchs` (AFTER UPDATE → finished)
-- =============================================================
--
--  Badges traités (déclenchement : status passe à 'finished' avec scores) :
--    - pronostic_parfait : 1 score exact
--    - sniper            : 5 scores exacts cumul
--    - prophete          : 10 scores exacts cumul
--    - centurion         : 50 pronos corrects (points_base > 0) cumul
--    - streak_5          : 5 pronos corrects d'affilée dans un concours
--    - double_digit      : score exact sur match ≥ 4 buts
--    - cold_blooded      : score exact sur 0-0
--    - upset_caller      : bon résultat sur cote_appliquee >= 3.0
--    - tab_master        : vainqueur_tab correct sur KO à égalité
--    - bonus_hunter      : 3 pronos corrects en phase KO
--    - leader            : rang 1 d'un concours (≥ 10 matchs finis)
--    - oracle            : 6/6 vainqueurs d'une poule complète
--
--  On itère sur tous les pronos du match (user x concours). Pour chaque
--  user, on recalcule les compteurs cumul via v_pronos_points (qui filtre
--  déjà is_final=true, donc inclut ce match une fois le UPDATE committé).

create or replace function public.handle_badges_on_match_finished()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prono record;
  v_pp record;
  v_total_exact int;
  v_total_correct int;
  v_streak int;
  v_streak_prono record;
  v_streak_broken boolean;
  v_ko_correct int;
  v_rang int;
  v_finished_count int;
  v_participants_count int;
  v_group_correct int;
  v_group_total int;
  v_group_name text;
  v_is_draw_ko boolean;
begin
  -- Guard : seulement si on passe à 'finished' avec scores
  if new.status <> 'finished'
     or new.score_a is null
     or new.score_b is null
  then
    return null;
  end if;

  -- Guard : éviter de rejouer si déjà finished
  if old.status = 'finished'
     and old.score_a is not distinct from new.score_a
     and old.score_b is not distinct from new.score_b
     and old.vainqueur_tab is not distinct from new.vainqueur_tab
  then
    return null;
  end if;

  -- Déterminer si c'est un KO à égalité (utile pour tab_master)
  v_is_draw_ko := (new.phase <> 'groupes' and new.score_a = new.score_b);

  -- Itérer sur tous les pronos du match (cross concours / user)
  for v_prono in
    select p.concours_id, p.user_id, p.score_a as p_a, p.score_b as p_b, p.vainqueur_tab as p_tab
    from public.pronos p
    where p.match_id = new.id
  loop
    -- Charger la ligne calculée v_pronos_points pour ce prono
    select pp.is_exact, pp.points_base, pp.bonus_ko, pp.cote_appliquee
      into v_pp
    from public.v_pronos_points pp
    where pp.concours_id = v_prono.concours_id
      and pp.user_id = v_prono.user_id
      and pp.match_id = new.id;

    if v_pp.points_base is null then
      continue; -- sécurité
    end if;

    -- pronostic_parfait : 1 score exact
    if v_pp.is_exact then
      perform public.award_badge(v_prono.user_id, 'pronostic_parfait',
        jsonb_build_object('concours_id', v_prono.concours_id, 'match_id', new.id));
    end if;

    -- Cumul des exacts pour sniper/prophete
    select count(*) into v_total_exact
    from public.v_pronos_points
    where user_id = v_prono.user_id
      and is_exact = true;

    if v_total_exact >= 5 then
      perform public.award_badge(v_prono.user_id, 'sniper',
        jsonb_build_object('match_id', new.id));
    end if;
    if v_total_exact >= 10 then
      perform public.award_badge(v_prono.user_id, 'prophete',
        jsonb_build_object('match_id', new.id));
    end if;

    -- centurion : 50 pronos corrects (points_base > 0) cumul
    select count(*) into v_total_correct
    from public.v_pronos_points
    where user_id = v_prono.user_id
      and is_final = true
      and points_base > 0;

    if v_total_correct >= 50 then
      perform public.award_badge(v_prono.user_id, 'centurion',
        jsonb_build_object('match_id', new.id));
    end if;

    -- double_digit : score exact sur match ≥ 4 buts au total
    if v_pp.is_exact and (new.score_a + new.score_b) >= 4 then
      perform public.award_badge(v_prono.user_id, 'double_digit',
        jsonb_build_object('concours_id', v_prono.concours_id, 'match_id', new.id));
    end if;

    -- cold_blooded : score exact sur 0-0
    if v_pp.is_exact and new.score_a = 0 and new.score_b = 0 then
      perform public.award_badge(v_prono.user_id, 'cold_blooded',
        jsonb_build_object('concours_id', v_prono.concours_id, 'match_id', new.id));
    end if;

    -- upset_caller : bon résultat sur cote appliquée >= 3.0
    if v_pp.points_base > 0
       and v_pp.cote_appliquee is not null
       and v_pp.cote_appliquee >= 3.0
    then
      perform public.award_badge(v_prono.user_id, 'upset_caller',
        jsonb_build_object('concours_id', v_prono.concours_id, 'match_id', new.id,
                           'cote', v_pp.cote_appliquee));
    end if;

    -- tab_master : vainqueur_tab pronostiqué = vainqueur_tab réel (KO à égalité)
    if v_is_draw_ko
       and new.vainqueur_tab is not null
       and v_prono.p_tab is not null
       and v_prono.p_tab = new.vainqueur_tab
    then
      perform public.award_badge(v_prono.user_id, 'tab_master',
        jsonb_build_object('concours_id', v_prono.concours_id, 'match_id', new.id));
    end if;

    -- bonus_hunter : 3 pronos corrects en phase KO (cumul)
    select count(*) into v_ko_correct
    from public.v_pronos_points
    where user_id = v_prono.user_id
      and is_final = true
      and points_base > 0
      and phase <> 'groupes';

    if v_ko_correct >= 3 then
      perform public.award_badge(v_prono.user_id, 'bonus_hunter',
        jsonb_build_object('match_id', new.id));
    end if;

    -- streak_5 : 5 pronos corrects d'affilée dans CE concours
    -- On parcourt les matchs finis du concours dans l'ordre kick_off_at
    -- pour ce user, on compte la plus longue série courante terminant
    -- par ce match.
    v_streak := 0;
    v_streak_broken := false;
    for v_streak_prono in
      select pp.points_base, m.kick_off_at
      from public.v_pronos_points pp
      inner join public.matchs m on m.id = pp.match_id
      where pp.user_id = v_prono.user_id
        and pp.concours_id = v_prono.concours_id
        and pp.is_final = true
      order by m.kick_off_at desc
    loop
      exit when v_streak_broken;
      if v_streak_prono.points_base > 0 then
        v_streak := v_streak + 1;
      else
        v_streak_broken := true;
      end if;
      exit when v_streak >= 5;
    end loop;

    if v_streak >= 5 then
      perform public.award_badge(v_prono.user_id, 'streak_5',
        jsonb_build_object('concours_id', v_prono.concours_id));
    end if;

    -- leader : rang 1 dans le concours après >= 10 matchs finis
    select count(*) into v_finished_count
    from public.matchs m
    where m.competition_id = new.competition_id
      and m.status = 'finished';

    if v_finished_count >= 10 then
      select rang into v_rang
      from public.v_classement_concours
      where concours_id = v_prono.concours_id
        and user_id = v_prono.user_id;

      if v_rang = 1 then
        perform public.award_badge(v_prono.user_id, 'leader',
          jsonb_build_object('concours_id', v_prono.concours_id));
      end if;
    end if;

    -- oracle : 6/6 vainqueurs (sign(score_a - score_b)) sur une poule complète
    -- Uniquement si le match finissant est en phase de groupes
    if new.phase = 'groupes' then
      select e.groupe into v_group_name
      from public.equipes e
      where e.id = new.equipe_a_id;

      if v_group_name is not null then
        -- Total de matchs finis de cette poule
        select count(*)
          into v_group_total
        from public.matchs m
        inner join public.equipes ea on ea.id = m.equipe_a_id
        where m.competition_id = new.competition_id
          and m.phase = 'groupes'
          and ea.groupe = v_group_name;

        -- Nombre de matchs de la poule où ce user a le bon vainqueur
        -- (sign(p_a - p_b) = sign(m_a - m_b))
        select count(*)
          into v_group_correct
        from public.pronos p
        inner join public.matchs m on m.id = p.match_id
        inner join public.equipes ea on ea.id = m.equipe_a_id
        where p.user_id = v_prono.user_id
          and p.concours_id = v_prono.concours_id
          and m.competition_id = new.competition_id
          and m.phase = 'groupes'
          and ea.groupe = v_group_name
          and m.status = 'finished'
          and m.score_a is not null
          and m.score_b is not null
          and sign(p.score_a - p.score_b) = sign(m.score_a - m.score_b);

        if v_group_total > 0 and v_group_correct >= v_group_total then
          perform public.award_badge(v_prono.user_id, 'oracle',
            jsonb_build_object('concours_id', v_prono.concours_id,
                               'competition_id', new.competition_id,
                               'groupe', v_group_name));
        end if;
      end if;
    end if;

  end loop;

  return null;
end;
$$;

create trigger badges_on_match_finished
after update on public.matchs
for each row execute function public.handle_badges_on_match_finished();

-- =============================================================
--  TRIGGERS attachés à `competitions` (AFTER UPDATE → finished)
-- =============================================================
--
--  Badges traités (quand une compétition passe à 'finished') :
--    - podium    : top 3 final d'un concours (≥ 3 participants)
--    - champion  : rang 1 final d'un concours (≥ 3 participants)
--
--  On parcourt tous les concours de la compétition, snapshot final
--  de v_classement_concours, attribution en fonction du rang.

create or replace function public.handle_badges_on_competition_finished()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_concours record;
  v_row record;
  v_participants_count int;
begin
  -- Guard : déclenchement uniquement sur transition -> 'finished'
  if new.status <> 'finished' or old.status = 'finished' then
    return null;
  end if;

  -- Pour chaque concours attaché à cette compétition
  for v_concours in
    select id from public.concours where competition_id = new.id
  loop
    -- On exige au moins 3 participants pour que podium/champion ait du sens
    select count(*) into v_participants_count
    from public.concours_participants
    where concours_id = v_concours.id;

    if v_participants_count < 3 then
      continue;
    end if;

    -- Parcours du classement final trié par rang
    for v_row in
      select user_id, rang
      from public.v_classement_concours
      where concours_id = v_concours.id
      order by rang asc
    loop
      if v_row.rang = 1 then
        perform public.award_badge(v_row.user_id, 'champion',
          jsonb_build_object('concours_id', v_concours.id,
                             'competition_id', new.id));
        perform public.award_badge(v_row.user_id, 'podium',
          jsonb_build_object('concours_id', v_concours.id,
                             'competition_id', new.id,
                             'rang', 1));
      elsif v_row.rang in (2, 3) then
        perform public.award_badge(v_row.user_id, 'podium',
          jsonb_build_object('concours_id', v_concours.id,
                             'competition_id', new.id,
                             'rang', v_row.rang));
      else
        exit; -- rang > 3, on arrête
      end if;
    end loop;
  end loop;

  return null;
end;
$$;

create trigger badges_on_competition_finished
after update on public.competitions
for each row execute function public.handle_badges_on_competition_finished();

-- =============================================================
--  Publication Realtime
-- =============================================================
-- Permet au front de rafraîchir automatiquement la section "Mes badges"
-- quand un badge vient d'être attribué (trigger SQL en arrière-plan).

alter publication supabase_realtime add table public.user_badges;
