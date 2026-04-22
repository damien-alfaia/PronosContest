-- =============================================================
--  Tests SQL maison — Jokers acquisition (Sprint 8.A)
-- =============================================================
--
--  Exécution (DB locale `supabase start` active) :
--    psql postgresql://postgres:postgres@localhost:54322/postgres \
--         -v ON_ERROR_STOP=1 \
--         -f supabase/tests/jokers_acquisition.sql
--
--  Principe : transaction BEGIN ... ROLLBACK. Chaque scénario en
--  DO $$ ... ASSERT ... END $$. ON_ERROR_STOP=1 fait tout tomber
--  au premier assert faux.
--
--  Scope 8.A : acquisition uniquement (starter + badge unlocks +
--  backfill à l'opt-in). L'usage (RPC use_joker, effets scoring,
--  challenges, gift) est testé en 8.B / 8.C / 8.D.
--
--  Scénarios :
--    Setup : 5 users (j1..j5)
--    1.  Catalogue seedé : 7 jokers exactement
--    2.  jokers_starter_codes() == array['double','boussole','challenge']
--    3.  badge_to_joker_code() : mappings attendus + null pour autres
--    4.  is_concours_jokers_enabled() : false / true selon concours
--    5.  Starter pack attribué au join si jokers_enabled=true
--    6.  PAS de starter pack si jokers_enabled=false
--    7.  Owner du concours (auto-participant via trigger Sprint 2)
--        reçoit le starter pack
--    8.  Backfill badges : user avec badge mappé → joker attribué
--        au join
--    9.  Badge non-mappé au join : pas de joker parasite
--    10. Badge gagné APRÈS join : trigger user_badges attribue le
--        joker dans tous les concours jokers_enabled
--    11. Badge gagné sur concours sans jokers_enabled : rien n'est
--        attribué dans ce concours, mais OK dans les autres
--    12. Opt-in a posteriori : jokers_enabled false → true →
--        starter + backfill pour tous les participants existants
--    13. Opt-in re-update true → true : rien ne se re-crée (idempotent)
--    14. Unique index partiel 'starter' : award_joker ne duplique pas
--    15. Unique index partiel 'badge' : award_joker ne duplique pas
--    16. Gift sans unique : plusieurs slots 'gift' du même joker
--        peuvent coexister (préparation 8.D)
-- =============================================================

begin;

-- ------------------------------------------------------------
--  Setup : 5 users pour pouvoir tester multi-users
-- ------------------------------------------------------------

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, encrypted_password,
  created_at, updated_at
) values
  ('a1111111-1111-1111-1111-111111111111'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'j1@test.local', now(),
   '{}'::jsonb, '{}'::jsonb, '', now(), now()),
  ('a2222222-2222-2222-2222-222222222222'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'j2@test.local', now(),
   '{}'::jsonb, '{}'::jsonb, '', now(), now()),
  ('a3333333-3333-3333-3333-333333333333'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'j3@test.local', now(),
   '{}'::jsonb, '{}'::jsonb, '', now(), now()),
  ('a4444444-4444-4444-4444-444444444444'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'j4@test.local', now(),
   '{}'::jsonb, '{}'::jsonb, '', now(), now()),
  ('a5555555-5555-5555-5555-555555555555'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'j5@test.local', now(),
   '{}'::jsonb, '{}'::jsonb, '', now(), now());

-- ------------------------------------------------------------
--  Test 1 : catalogue seedé (7 jokers)
-- ------------------------------------------------------------
do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.jokers;
  assert v_count = 7, format('Expected 7 jokers, got %s', v_count);
  raise notice 'TEST 1 OK — Catalogue : 7 jokers seedés';
end $$;

-- ------------------------------------------------------------
--  Test 2 : jokers_starter_codes()
-- ------------------------------------------------------------
do $$
declare
  v_codes text[];
begin
  v_codes := public.jokers_starter_codes();
  assert v_codes = array['double','boussole','challenge']::text[],
    format('Starter codes unexpected: %s', v_codes);
  raise notice 'TEST 2 OK — starter codes corrects';
end $$;

-- ------------------------------------------------------------
--  Test 3 : badge_to_joker_code()
-- ------------------------------------------------------------
do $$
begin
  assert public.badge_to_joker_code('rookie')            = 'triple',     'rookie → triple';
  assert public.badge_to_joker_code('pronostic_parfait') = 'safety_net', 'pronostic_parfait → safety_net';
  assert public.badge_to_joker_code('groupe_parfait')    = 'double_down','groupe_parfait → double_down';
  assert public.badge_to_joker_code('host')              = 'gift',       'host → gift';
  assert public.badge_to_joker_code('sniper')            is null,        'sniper → null';
  assert public.badge_to_joker_code('inexistant')        is null,        'inexistant → null';
  raise notice 'TEST 3 OK — mapping badge→joker cohérent';
end $$;

-- ------------------------------------------------------------
--  Test 4 : is_concours_jokers_enabled()
-- ------------------------------------------------------------
savepoint t4;
do $$
declare
  v_comp_id uuid;
  v_c_off uuid := 'c0000000-0000-0000-0000-000000000041'::uuid;
  v_c_on  uuid := 'c0000000-0000-0000-0000-000000000042'::uuid;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility, jokers_enabled)
  values
    (v_c_off, 'Test-04-off', v_comp_id, 'a1111111-1111-1111-1111-111111111111', 'public', false),
    (v_c_on,  'Test-04-on',  v_comp_id, 'a1111111-1111-1111-1111-111111111111', 'public', true);

  assert public.is_concours_jokers_enabled(v_c_off) = false, 'concours_off attendu false';
  assert public.is_concours_jokers_enabled(v_c_on)  = true,  'concours_on attendu true';
  assert public.is_concours_jokers_enabled('00000000-0000-0000-0000-000000000000') = false,
         'concours inconnu attendu false';
  raise notice 'TEST 4 OK — is_concours_jokers_enabled';
end $$;
rollback to savepoint t4;

-- ------------------------------------------------------------
--  Test 5 : starter pack attribué au join (jokers_enabled=true)
-- ------------------------------------------------------------
savepoint t5;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := 'c0000000-0000-0000-0000-000000000051'::uuid;
  v_codes text[];
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility, jokers_enabled)
  values (v_concours_id, 'Test-05', v_comp_id, 'a1111111-1111-1111-1111-111111111111', 'public', true);

  -- Join j2 manuellement (j1 = owner, déjà participant via trigger Sprint 2)
  insert into public.concours_participants (concours_id, user_id, role)
  values (v_concours_id, 'a2222222-2222-2222-2222-222222222222', 'member');

  select array_agg(joker_code order by joker_code) into v_codes
  from public.user_jokers
  where user_id = 'a2222222-2222-2222-2222-222222222222'
    and concours_id = v_concours_id
    and acquired_from = 'starter';

  assert v_codes = array['boussole','challenge','double']::text[],
    format('Starter pack j2 attendu, got %s', v_codes);
  raise notice 'TEST 5 OK — starter pack attribué au join';
end $$;
rollback to savepoint t5;

-- ------------------------------------------------------------
--  Test 6 : PAS de starter pack si jokers_enabled=false
-- ------------------------------------------------------------
savepoint t6;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := 'c0000000-0000-0000-0000-000000000061'::uuid;
  v_count int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility, jokers_enabled)
  values (v_concours_id, 'Test-06', v_comp_id, 'a1111111-1111-1111-1111-111111111111', 'public', false);

  insert into public.concours_participants (concours_id, user_id, role)
  values (v_concours_id, 'a2222222-2222-2222-2222-222222222222', 'member');

  select count(*) into v_count from public.user_jokers
  where user_id = 'a2222222-2222-2222-2222-222222222222'
    and concours_id = v_concours_id;

  assert v_count = 0, format('Aucun joker attendu, got %s', v_count);
  raise notice 'TEST 6 OK — opt-in off : aucun joker';
end $$;
rollback to savepoint t6;

-- ------------------------------------------------------------
--  Test 7 : owner auto-participant reçoit starter pack
-- ------------------------------------------------------------
savepoint t7;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := 'c0000000-0000-0000-0000-000000000071'::uuid;
  v_count int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  -- L'INSERT concours déclenche le trigger Sprint 2 qui auto-ajoute
  -- l'owner dans concours_participants, ce qui déclenche à son tour
  -- notre trigger jokers_on_participant_insert.
  insert into public.concours (id, nom, competition_id, owner_id, visibility, jokers_enabled)
  values (v_concours_id, 'Test-07', v_comp_id, 'a3333333-3333-3333-3333-333333333333', 'public', true);

  select count(*) into v_count
  from public.user_jokers
  where user_id = 'a3333333-3333-3333-3333-333333333333'
    and concours_id = v_concours_id
    and acquired_from = 'starter';

  assert v_count = 3, format('Owner doit avoir 3 jokers starter, got %s', v_count);
  raise notice 'TEST 7 OK — owner reçoit starter pack';
end $$;
rollback to savepoint t7;

-- ------------------------------------------------------------
--  Test 8 : backfill badges au join
--  j4 gagne 'host' (avant toute inscription concours), puis rejoint
--  un concours jokers_enabled → il doit recevoir starter + gift.
-- ------------------------------------------------------------
savepoint t8;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := 'c0000000-0000-0000-0000-000000000081'::uuid;
  v_has_gift boolean;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  -- Attribuer manuellement 'host' à j4 (simule : il a déjà créé 3 concours)
  insert into public.user_badges (user_id, badge_code)
  values ('a4444444-4444-4444-4444-444444444444', 'host')
  on conflict do nothing;

  -- Concours jokers_enabled appartenant à un autre user (j1)
  insert into public.concours (id, nom, competition_id, owner_id, visibility, jokers_enabled)
  values (v_concours_id, 'Test-08', v_comp_id, 'a1111111-1111-1111-1111-111111111111', 'public', true);

  -- j4 rejoint
  insert into public.concours_participants (concours_id, user_id, role)
  values (v_concours_id, 'a4444444-4444-4444-4444-444444444444', 'member');

  -- j4 doit avoir gift (via backfill badge)
  select exists (
    select 1 from public.user_jokers
    where user_id = 'a4444444-4444-4444-4444-444444444444'
      and concours_id = v_concours_id
      and joker_code = 'gift'
      and acquired_from = 'badge'
  ) into v_has_gift;

  assert v_has_gift, 'j4 doit recevoir gift via backfill badge';
  raise notice 'TEST 8 OK — backfill badges au join';
end $$;
rollback to savepoint t8;

-- ------------------------------------------------------------
--  Test 9 : badge non-mappé = pas de joker parasite
-- ------------------------------------------------------------
savepoint t9;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := 'c0000000-0000-0000-0000-000000000091'::uuid;
  v_count int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  -- j5 a un badge non-mappé
  insert into public.user_badges (user_id, badge_code)
  values ('a5555555-5555-5555-5555-555555555555', 'sniper')
  on conflict do nothing;

  insert into public.concours (id, nom, competition_id, owner_id, visibility, jokers_enabled)
  values (v_concours_id, 'Test-09', v_comp_id, 'a1111111-1111-1111-1111-111111111111', 'public', true);

  insert into public.concours_participants (concours_id, user_id, role)
  values (v_concours_id, 'a5555555-5555-5555-5555-555555555555', 'member');

  -- Doit avoir 3 starter, 0 badge (sniper ne mappe rien)
  select count(*) into v_count from public.user_jokers
  where user_id = 'a5555555-5555-5555-5555-555555555555'
    and concours_id = v_concours_id
    and acquired_from = 'badge';

  assert v_count = 0, format('Badges non-mappés : 0 joker, got %s', v_count);
  raise notice 'TEST 9 OK — badge non-mappé = pas de joker parasite';
end $$;
rollback to savepoint t9;

-- ------------------------------------------------------------
--  Test 10 : badge gagné APRÈS join = propagation via trigger
--  j2 rejoint un concours jokers_enabled (reçoit starter).
--  Ensuite il gagne 'pronostic_parfait' → doit recevoir safety_net.
-- ------------------------------------------------------------
savepoint t10;
do $$
declare
  v_comp_id uuid;
  v_c uuid := 'c0000000-0000-0000-0000-000000000101'::uuid;
  v_has_safety boolean;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility, jokers_enabled)
  values (v_c, 'Test-10', v_comp_id, 'a1111111-1111-1111-1111-111111111111', 'public', true);
  insert into public.concours_participants (concours_id, user_id, role)
  values (v_c, 'a2222222-2222-2222-2222-222222222222', 'member');

  -- Gain de badge ultérieur
  insert into public.user_badges (user_id, badge_code)
  values ('a2222222-2222-2222-2222-222222222222', 'pronostic_parfait')
  on conflict do nothing;

  select exists (
    select 1 from public.user_jokers
    where user_id = 'a2222222-2222-2222-2222-222222222222'
      and concours_id = v_c
      and joker_code = 'safety_net'
      and acquired_from = 'badge'
  ) into v_has_safety;

  assert v_has_safety, 'safety_net attendu après pronostic_parfait';
  raise notice 'TEST 10 OK — badge post-join propagé';
end $$;
rollback to savepoint t10;

-- ------------------------------------------------------------
--  Test 11 : badge gagné n'affecte que les concours jokers_enabled
--  j3 est dans 2 concours (un avec opt-in, un sans). Gain d'un badge
--  mappé → joker uniquement dans le concours opt-in.
-- ------------------------------------------------------------
savepoint t11;
do $$
declare
  v_comp_id uuid;
  v_c_on  uuid := 'c0000000-0000-0000-0000-000000000111'::uuid;
  v_c_off uuid := 'c0000000-0000-0000-0000-000000000112'::uuid;
  v_count_on  int;
  v_count_off int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility, jokers_enabled)
  values
    (v_c_on,  'Test-11-on',  v_comp_id, 'a1111111-1111-1111-1111-111111111111', 'public', true),
    (v_c_off, 'Test-11-off', v_comp_id, 'a1111111-1111-1111-1111-111111111111', 'public', false);

  insert into public.concours_participants (concours_id, user_id, role)
  values
    (v_c_on,  'a3333333-3333-3333-3333-333333333333', 'member'),
    (v_c_off, 'a3333333-3333-3333-3333-333333333333', 'member');

  insert into public.user_badges (user_id, badge_code)
  values ('a3333333-3333-3333-3333-333333333333', 'rookie')
  on conflict do nothing;

  select count(*) into v_count_on  from public.user_jokers
  where user_id = 'a3333333-3333-3333-3333-333333333333'
    and concours_id = v_c_on and joker_code = 'triple';

  select count(*) into v_count_off from public.user_jokers
  where user_id = 'a3333333-3333-3333-3333-333333333333'
    and concours_id = v_c_off and joker_code = 'triple';

  assert v_count_on  = 1, format('concours opt-in : triple attendu, got %s', v_count_on);
  assert v_count_off = 0, format('concours opt-off : pas de triple, got %s', v_count_off);
  raise notice 'TEST 11 OK — propagation badge restreinte aux concours opt-in';
end $$;
rollback to savepoint t11;

-- ------------------------------------------------------------
--  Test 12 : opt-in a posteriori (false → true)
--  Concours créé avec jokers_enabled=false, plusieurs participants
--  avec/sans badges mappés. Puis bascule true → distribution
--  complète à tous.
-- ------------------------------------------------------------
savepoint t12;
do $$
declare
  v_comp_id uuid;
  v_c uuid := 'c0000000-0000-0000-0000-000000000121'::uuid;
  v_count_j2_starter int;
  v_count_j4_total int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  -- j4 a déjà un badge mappé (host)
  insert into public.user_badges (user_id, badge_code)
  values ('a4444444-4444-4444-4444-444444444444', 'host')
  on conflict do nothing;

  -- Concours jokers_enabled=false, plusieurs membres
  insert into public.concours (id, nom, competition_id, owner_id, visibility, jokers_enabled)
  values (v_c, 'Test-12', v_comp_id, 'a1111111-1111-1111-1111-111111111111', 'public', false);
  insert into public.concours_participants (concours_id, user_id, role)
  values
    (v_c, 'a2222222-2222-2222-2222-222222222222', 'member'),
    (v_c, 'a4444444-4444-4444-4444-444444444444', 'member');

  -- Aucun joker à ce stade
  assert (select count(*) from public.user_jokers where concours_id = v_c) = 0,
    'Avant opt-in : 0 joker attendu';

  -- Bascule
  update public.concours set jokers_enabled = true where id = v_c;

  -- j2 : 3 starter
  select count(*) into v_count_j2_starter from public.user_jokers
  where concours_id = v_c
    and user_id = 'a2222222-2222-2222-2222-222222222222'
    and acquired_from = 'starter';
  assert v_count_j2_starter = 3, format('j2 starter attendus 3, got %s', v_count_j2_starter);

  -- j4 : 3 starter + 1 gift (badge host)
  select count(*) into v_count_j4_total from public.user_jokers
  where concours_id = v_c
    and user_id = 'a4444444-4444-4444-4444-444444444444';
  assert v_count_j4_total = 4, format('j4 jokers attendus 4, got %s', v_count_j4_total);

  raise notice 'TEST 12 OK — opt-in a posteriori distribue à tous';
end $$;
rollback to savepoint t12;

-- ------------------------------------------------------------
--  Test 13 : opt-in re-update true→true = idempotent
-- ------------------------------------------------------------
savepoint t13;
do $$
declare
  v_comp_id uuid;
  v_c uuid := 'c0000000-0000-0000-0000-000000000131'::uuid;
  v_count_before int;
  v_count_after int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility, jokers_enabled)
  values (v_c, 'Test-13', v_comp_id, 'a1111111-1111-1111-1111-111111111111', 'public', true);

  -- 3 jokers starter pour l'owner auto-participant
  select count(*) into v_count_before from public.user_jokers where concours_id = v_c;
  assert v_count_before = 3, format('3 jokers attendus, got %s', v_count_before);

  -- Re-update true → true (touche la ligne mais transition identique)
  update public.concours set jokers_enabled = true, nom = 'Test-13-renamed' where id = v_c;

  select count(*) into v_count_after from public.user_jokers where concours_id = v_c;
  assert v_count_after = v_count_before,
    format('Re-update ne doit rien ajouter, got %s (avant: %s)', v_count_after, v_count_before);
  raise notice 'TEST 13 OK — opt-in re-update idempotent';
end $$;
rollback to savepoint t13;

-- ------------------------------------------------------------
--  Test 14 : award_joker idempotent pour starter
-- ------------------------------------------------------------
savepoint t14;
do $$
declare
  v_comp_id uuid;
  v_c uuid := 'c0000000-0000-0000-0000-000000000141'::uuid;
  v_count int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility, jokers_enabled)
  values (v_c, 'Test-14', v_comp_id, 'a1111111-1111-1111-1111-111111111111', 'public', true);

  -- Déjà 3 starter pour owner. Ré-attribuer 'double' manuellement.
  perform public.award_joker(
    'a1111111-1111-1111-1111-111111111111', v_c, 'double', 'starter'
  );
  perform public.award_joker(
    'a1111111-1111-1111-1111-111111111111', v_c, 'double', 'starter'
  );

  select count(*) into v_count from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and concours_id = v_c
    and joker_code = 'double'
    and acquired_from = 'starter';

  assert v_count = 1, format('starter double unique attendu, got %s', v_count);
  raise notice 'TEST 14 OK — award_joker starter idempotent';
end $$;
rollback to savepoint t14;

-- ------------------------------------------------------------
--  Test 15 : award_joker idempotent pour badge
-- ------------------------------------------------------------
savepoint t15;
do $$
declare
  v_comp_id uuid;
  v_c uuid := 'c0000000-0000-0000-0000-000000000151'::uuid;
  v_count int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility, jokers_enabled)
  values (v_c, 'Test-15', v_comp_id, 'a1111111-1111-1111-1111-111111111111', 'public', true);

  perform public.award_joker(
    'a1111111-1111-1111-1111-111111111111', v_c, 'triple', 'badge'
  );
  perform public.award_joker(
    'a1111111-1111-1111-1111-111111111111', v_c, 'triple', 'badge'
  );

  select count(*) into v_count from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and concours_id = v_c
    and joker_code = 'triple'
    and acquired_from = 'badge';

  assert v_count = 1, format('badge triple unique attendu, got %s', v_count);
  raise notice 'TEST 15 OK — award_joker badge idempotent';
end $$;
rollback to savepoint t15;

-- ------------------------------------------------------------
--  Test 16 : gift NON-idempotent (plusieurs slots autorisés)
--  Préparation 8.D (cadeaux) : deux INSERT gift sur le même joker
--  doivent cohabiter. On appelle award_joker directement ici car
--  il dédoublonne starter/badge ; gift passe par un INSERT brut
--  dans la RPC use_joker en 8.D.
-- ------------------------------------------------------------
savepoint t16;
do $$
declare
  v_comp_id uuid;
  v_c uuid := 'c0000000-0000-0000-0000-000000000161'::uuid;
  v_count int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility, jokers_enabled)
  values (v_c, 'Test-16', v_comp_id, 'a1111111-1111-1111-1111-111111111111', 'public', true);

  insert into public.user_jokers (user_id, concours_id, joker_code, acquired_from)
  values
    ('a1111111-1111-1111-1111-111111111111', v_c, 'double', 'gift'),
    ('a1111111-1111-1111-1111-111111111111', v_c, 'double', 'gift');

  select count(*) into v_count from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and concours_id = v_c
    and joker_code = 'double'
    and acquired_from = 'gift';

  assert v_count = 2, format('gift duplicable attendu, got %s', v_count);
  raise notice 'TEST 16 OK — gift non-idempotent (préparation 8.D)';
end $$;
rollback to savepoint t16;

rollback;

-- =============================================================
--  FIN DES TESTS JOKERS ACQUISITION (Sprint 8.A)
-- =============================================================
\echo 'Tous les tests jokers_acquisition ont passé.'
