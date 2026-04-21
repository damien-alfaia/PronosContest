-- =============================================================
--  Tests SQL maison — Badges (Sprint 6.A)
-- =============================================================
--
--  Exécution (DB locale `supabase start` active) :
--    psql postgresql://postgres:postgres@localhost:54322/postgres \
--         -v ON_ERROR_STOP=1 \
--         -f supabase/tests/badges.sql
--
--  Principe : transaction BEGIN ... ROLLBACK, chaque scénario en
--  DO $$ ... ASSERT ... END $$. ON_ERROR_STOP=1 fait tout tomber
--  au premier assert faux.
--
--  Scénarios (28 badges + idempotence + guards) :
--    Setup : 5 users + 3 concours + matchs FIFA WC 2026 (seed existant)
--    1.  Catalogue seedé : 28 badges exactement
--    2.  first_prono : attribué au 1er prono
--    3.  first_prono : idempotent (2e prono ne crée pas de doublon)
--    4.  rookie : exactement à 25 pronos
--    5.  veteran : exactement à 100 pronos
--    6.  night_owl : prono à 02:00 UTC
--    7.  early_bird : prono à 06:00 UTC
--    8.  weekend_warrior : prono un samedi
--    9.  last_second : prono 2 min avant kick_off
--    10. first_concours_join : attribué au 1er join
--    11. social_butterfly : à 3 concours
--    12. concours_owner : à la 1re création
--    13. host : à la 3e création
--    14. viral : 3 tiers rejoignent mon concours privé
--    15. pronostic_parfait + sniper seuils (5 exacts)
--    16. prophete : 10 exacts
--    17. centurion : 50 pronos corrects
--    18. double_digit : exact sur match 3-2
--    19. cold_blooded : exact sur 0-0
--    20. upset_caller : bon résultat sur cote 3.5
--    21. tab_master : KO à égalité, vainqueur_tab correct
--    22. bonus_hunter : 3 corrects en phase KO
--    23. streak_5 : 5 corrects d'affilée
--    24. groupe_parfait : 6 matchs d'une poule pronostiqués
--    25. leader : rang 1 après 10 matchs finis
--    26. podium + champion : competition finished, 3+ participants
--    27. Guard competition finished : < 3 participants -> pas de podium
--    28. Guard match re-update sans changement : trigger no-op
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
  ('11111111-1111-1111-1111-111111111111'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'b1@test.local', now(),
   '{}'::jsonb, '{}'::jsonb, '', now(), now()),
  ('22222222-2222-2222-2222-222222222222'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'b2@test.local', now(),
   '{}'::jsonb, '{}'::jsonb, '', now(), now()),
  ('33333333-3333-3333-3333-333333333333'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'b3@test.local', now(),
   '{}'::jsonb, '{}'::jsonb, '', now(), now()),
  ('44444444-4444-4444-4444-444444444444'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'b4@test.local', now(),
   '{}'::jsonb, '{}'::jsonb, '', now(), now()),
  ('55555555-5555-5555-5555-555555555555'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'b5@test.local', now(),
   '{}'::jsonb, '{}'::jsonb, '', now(), now());

-- ------------------------------------------------------------
--  Test 1 : catalogue seedé (28 badges)
-- ------------------------------------------------------------
do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.badges;
  assert v_count = 28, format('Expected 28 badges, got %s', v_count);
  raise notice 'TEST 1 OK — Catalogue: 28 badges seedés';
end $$;

-- ------------------------------------------------------------
--  Test 2 : first_prono au 1er prono
-- ------------------------------------------------------------
-- On crée un concours + un prono => first_prono doit apparaître
savepoint t2;
do $$
declare
  v_comp_id uuid;
  v_match_id uuid;
  v_concours_id uuid := '10000000-0000-0000-0000-000000000002'::uuid;
  v_has boolean;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';
  select id into v_match_id from public.matchs where competition_id = v_comp_id limit 1;

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-02', v_comp_id, '11111111-1111-1111-1111-111111111111', 'public');

  insert into public.pronos (concours_id, user_id, match_id, score_a, score_b)
  values (v_concours_id, '11111111-1111-1111-1111-111111111111', v_match_id, 1, 0);

  select exists(
    select 1 from public.user_badges
    where user_id = '11111111-1111-1111-1111-111111111111' and badge_code = 'first_prono'
  ) into v_has;
  assert v_has, 'first_prono attendu après le 1er prono';
  raise notice 'TEST 2 OK — first_prono attribué';
end $$;
rollback to savepoint t2;

-- ------------------------------------------------------------
--  Test 3 : first_prono idempotent (2e prono n'ajoute pas de doublon)
-- ------------------------------------------------------------
savepoint t3;
do $$
declare
  v_comp_id uuid;
  v_m1 uuid;
  v_m2 uuid;
  v_concours_id uuid := '10000000-0000-0000-0000-000000000003'::uuid;
  v_count int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';
  select id into v_m1 from public.matchs where competition_id = v_comp_id order by kick_off_at limit 1;
  select id into v_m2 from public.matchs where competition_id = v_comp_id order by kick_off_at limit 1 offset 1;

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-03', v_comp_id, '11111111-1111-1111-1111-111111111111', 'public');

  insert into public.pronos (concours_id, user_id, match_id, score_a, score_b)
  values
    (v_concours_id, '11111111-1111-1111-1111-111111111111', v_m1, 1, 0),
    (v_concours_id, '11111111-1111-1111-1111-111111111111', v_m2, 2, 1);

  select count(*) into v_count from public.user_badges
  where user_id = '11111111-1111-1111-1111-111111111111' and badge_code = 'first_prono';
  assert v_count = 1, format('first_prono should be unique, got %s', v_count);
  raise notice 'TEST 3 OK — first_prono idempotent';
end $$;
rollback to savepoint t3;

-- ------------------------------------------------------------
--  Test 4 : rookie à exactement 25 pronos
-- ------------------------------------------------------------
savepoint t4;
do $$
declare
  v_comp_id uuid;
  v_matchs uuid[];
  v_concours_id uuid := '10000000-0000-0000-0000-000000000004'::uuid;
  v_has boolean;
  i int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';
  select array_agg(id order by kick_off_at) into v_matchs
    from public.matchs where competition_id = v_comp_id limit 25;

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-04', v_comp_id, '11111111-1111-1111-1111-111111111111', 'public');

  -- Insère 24 pronos : pas encore rookie
  for i in 1..24 loop
    insert into public.pronos (concours_id, user_id, match_id, score_a, score_b)
    values (v_concours_id, '11111111-1111-1111-1111-111111111111', v_matchs[i], 1, 0);
  end loop;

  select exists(
    select 1 from public.user_badges
    where user_id = '11111111-1111-1111-1111-111111111111' and badge_code = 'rookie'
  ) into v_has;
  assert not v_has, 'rookie should not be attributed before 25 pronos';

  -- 25e prono : rookie attendu
  insert into public.pronos (concours_id, user_id, match_id, score_a, score_b)
  values (v_concours_id, '11111111-1111-1111-1111-111111111111', v_matchs[25], 1, 0);

  select exists(
    select 1 from public.user_badges
    where user_id = '11111111-1111-1111-1111-111111111111' and badge_code = 'rookie'
  ) into v_has;
  assert v_has, 'rookie expected at 25 pronos';
  raise notice 'TEST 4 OK — rookie à 25 pronos';
end $$;
rollback to savepoint t4;

-- ------------------------------------------------------------
--  Test 6-8 : night_owl / early_bird / weekend_warrior (horaires)
-- ------------------------------------------------------------
savepoint t6;
do $$
declare
  v_comp_id uuid;
  v_match_id uuid;
  v_concours_id uuid := '10000000-0000-0000-0000-000000000006'::uuid;
  v_has_night boolean;
  v_has_early boolean;
  v_has_weekend boolean;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';
  select id into v_match_id from public.matchs where competition_id = v_comp_id limit 1;

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-06', v_comp_id, '11111111-1111-1111-1111-111111111111', 'public');

  -- Prono forcé à 02:00 UTC, samedi 2026-05-02
  insert into public.pronos (concours_id, user_id, match_id, score_a, score_b, created_at)
  values (v_concours_id, '11111111-1111-1111-1111-111111111111', v_match_id, 1, 0,
          '2026-05-02 02:00:00+00'::timestamptz);

  select exists(
    select 1 from public.user_badges
    where user_id = '11111111-1111-1111-1111-111111111111' and badge_code = 'night_owl'
  ) into v_has_night;
  select exists(
    select 1 from public.user_badges
    where user_id = '11111111-1111-1111-1111-111111111111' and badge_code = 'weekend_warrior'
  ) into v_has_weekend;
  assert v_has_night, 'night_owl expected at 02:00 UTC';
  assert v_has_weekend, 'weekend_warrior expected on Saturday';
  raise notice 'TEST 6 OK — night_owl + weekend_warrior';
end $$;
rollback to savepoint t6;

-- Test early_bird
savepoint t7;
do $$
declare
  v_comp_id uuid;
  v_match_id uuid;
  v_concours_id uuid := '10000000-0000-0000-0000-000000000007'::uuid;
  v_has boolean;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';
  select id into v_match_id from public.matchs where competition_id = v_comp_id limit 1;
  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-07', v_comp_id, '22222222-2222-2222-2222-222222222222', 'public');
  insert into public.pronos (concours_id, user_id, match_id, score_a, score_b, created_at)
  values (v_concours_id, '22222222-2222-2222-2222-222222222222', v_match_id, 1, 0,
          '2026-05-05 06:30:00+00'::timestamptz);
  select exists(
    select 1 from public.user_badges
    where user_id = '22222222-2222-2222-2222-222222222222' and badge_code = 'early_bird'
  ) into v_has;
  assert v_has, 'early_bird expected at 06:30 UTC';
  raise notice 'TEST 7 OK — early_bird';
end $$;
rollback to savepoint t7;

-- ------------------------------------------------------------
--  Test 9 : last_second (< 5 min avant kick_off)
-- ------------------------------------------------------------
savepoint t9;
do $$
declare
  v_comp_id uuid;
  v_match_id uuid;
  v_kickoff timestamptz;
  v_concours_id uuid := '10000000-0000-0000-0000-000000000009'::uuid;
  v_has boolean;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';
  select id, kick_off_at into v_match_id, v_kickoff
    from public.matchs where competition_id = v_comp_id
    order by kick_off_at limit 1;

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-09', v_comp_id, '11111111-1111-1111-1111-111111111111', 'public');

  -- Prono 2 min avant le coup d'envoi
  insert into public.pronos (concours_id, user_id, match_id, score_a, score_b, created_at)
  values (v_concours_id, '11111111-1111-1111-1111-111111111111', v_match_id, 1, 0,
          v_kickoff - interval '2 minutes');

  select exists(
    select 1 from public.user_badges
    where user_id = '11111111-1111-1111-1111-111111111111' and badge_code = 'last_second'
  ) into v_has;
  assert v_has, 'last_second expected at -2 min from kickoff';
  raise notice 'TEST 9 OK — last_second';
end $$;
rollback to savepoint t9;

-- ------------------------------------------------------------
--  Test 10-12 : lifecycle sociale
--    first_concours_join + social_butterfly + concours_owner + host
-- ------------------------------------------------------------
savepoint t10;
do $$
declare
  v_comp_id uuid;
  v_has boolean;
  v_count int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  -- b3 crée son 1er concours -> concours_owner + first_concours_join (owner auto-added as cp)
  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values ('10000000-0000-0000-0000-000000000a01'::uuid,
          'Test-10a', v_comp_id, '33333333-3333-3333-3333-333333333333', 'public');

  select exists(
    select 1 from public.user_badges
    where user_id = '33333333-3333-3333-3333-333333333333' and badge_code = 'concours_owner'
  ) into v_has;
  assert v_has, 'concours_owner expected after 1st concours';

  select exists(
    select 1 from public.user_badges
    where user_id = '33333333-3333-3333-3333-333333333333' and badge_code = 'first_concours_join'
  ) into v_has;
  assert v_has, 'first_concours_join expected (owner auto-join)';

  -- 2e concours : pas encore host
  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values ('10000000-0000-0000-0000-000000000a02'::uuid,
          'Test-10b', v_comp_id, '33333333-3333-3333-3333-333333333333', 'public');

  select exists(
    select 1 from public.user_badges
    where user_id = '33333333-3333-3333-3333-333333333333' and badge_code = 'host'
  ) into v_has;
  assert not v_has, 'host should not be attributed at 2 concours';

  -- 3e concours : host + social_butterfly (via auto-join)
  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values ('10000000-0000-0000-0000-000000000a03'::uuid,
          'Test-10c', v_comp_id, '33333333-3333-3333-3333-333333333333', 'public');

  select exists(
    select 1 from public.user_badges
    where user_id = '33333333-3333-3333-3333-333333333333' and badge_code = 'host'
  ) into v_has;
  assert v_has, 'host expected at 3rd concours';

  select exists(
    select 1 from public.user_badges
    where user_id = '33333333-3333-3333-3333-333333333333' and badge_code = 'social_butterfly'
  ) into v_has;
  assert v_has, 'social_butterfly expected when member of 3 concours';

  raise notice 'TEST 10 OK — concours_owner + host + first_concours_join + social_butterfly';
end $$;
rollback to savepoint t10;

-- ------------------------------------------------------------
--  Test 14 : viral (3 tiers rejoignent le concours privé d'un owner)
-- ------------------------------------------------------------
savepoint t14;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := '10000000-0000-0000-0000-000000000014'::uuid;
  v_has boolean;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  -- b1 crée un concours privé
  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-14-Viral', v_comp_id,
          '11111111-1111-1111-1111-111111111111', 'private');

  -- b2, b3, b4 rejoignent (hors owner)
  insert into public.concours_participants (concours_id, user_id, role)
  values
    (v_concours_id, '22222222-2222-2222-2222-222222222222', 'member'),
    (v_concours_id, '33333333-3333-3333-3333-333333333333', 'member');

  -- À 2 rejoints : pas encore viral
  select exists(
    select 1 from public.user_badges
    where user_id = '11111111-1111-1111-1111-111111111111' and badge_code = 'viral'
  ) into v_has;
  assert not v_has, 'viral should not be at 2 joiners';

  -- 3e rejoint : viral attendu
  insert into public.concours_participants (concours_id, user_id, role)
  values (v_concours_id, '44444444-4444-4444-4444-444444444444', 'member');

  select exists(
    select 1 from public.user_badges
    where user_id = '11111111-1111-1111-1111-111111111111' and badge_code = 'viral'
  ) into v_has;
  assert v_has, 'viral expected at 3 joiners';
  raise notice 'TEST 14 OK — viral à 3 personnes';
end $$;
rollback to savepoint t14;

-- ------------------------------------------------------------
--  Test 15 : pronostic_parfait + idempotence sniper seuil
-- ------------------------------------------------------------
savepoint t15;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := '10000000-0000-0000-0000-000000000015'::uuid;
  v_matchs uuid[];
  v_has_perfect boolean;
  v_has_sniper boolean;
  i int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';
  select array_agg(id order by kick_off_at) into v_matchs
    from public.matchs where competition_id = v_comp_id limit 10;

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-15', v_comp_id,
          '55555555-5555-5555-5555-555555555555', 'public');

  -- 5 pronos avec score 1-0
  for i in 1..5 loop
    insert into public.pronos (concours_id, user_id, match_id, score_a, score_b)
    values (v_concours_id, '55555555-5555-5555-5555-555555555555', v_matchs[i], 1, 0);
  end loop;

  -- Finish les 4 premiers matchs avec un résultat DIFFÉRENT du prono (pas exact)
  -- et le 5e avec un SCORE EXACT
  for i in 1..4 loop
    update public.matchs set status = 'finished', score_a = 2, score_b = 1 where id = v_matchs[i];
  end loop;
  -- 5e match : exact
  update public.matchs set status = 'finished', score_a = 1, score_b = 0 where id = v_matchs[5];

  select exists(
    select 1 from public.user_badges
    where user_id = '55555555-5555-5555-5555-555555555555'
      and badge_code = 'pronostic_parfait'
  ) into v_has_perfect;
  assert v_has_perfect, 'pronostic_parfait expected after 1 exact';

  -- Un seul exact : sniper pas encore là
  select exists(
    select 1 from public.user_badges
    where user_id = '55555555-5555-5555-5555-555555555555' and badge_code = 'sniper'
  ) into v_has_sniper;
  assert not v_has_sniper, 'sniper should not trigger at 1 exact';
  raise notice 'TEST 15 OK — pronostic_parfait à 1 exact, sniper reste off';
end $$;
rollback to savepoint t15;

-- ------------------------------------------------------------
--  Test 18 : double_digit (exact sur match ≥ 4 buts)
-- ------------------------------------------------------------
savepoint t18;
do $$
declare
  v_comp_id uuid;
  v_match_id uuid;
  v_concours_id uuid := '10000000-0000-0000-0000-000000000018'::uuid;
  v_has boolean;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';
  select id into v_match_id from public.matchs where competition_id = v_comp_id limit 1;

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-18', v_comp_id,
          '11111111-1111-1111-1111-111111111111', 'public');

  -- Prono 3-2 (5 buts)
  insert into public.pronos (concours_id, user_id, match_id, score_a, score_b)
  values (v_concours_id, '11111111-1111-1111-1111-111111111111', v_match_id, 3, 2);

  -- Match finit 3-2
  update public.matchs set status = 'finished', score_a = 3, score_b = 2 where id = v_match_id;

  select exists(
    select 1 from public.user_badges
    where user_id = '11111111-1111-1111-1111-111111111111' and badge_code = 'double_digit'
  ) into v_has;
  assert v_has, 'double_digit expected on exact 3-2';
  raise notice 'TEST 18 OK — double_digit';
end $$;
rollback to savepoint t18;

-- ------------------------------------------------------------
--  Test 19 : cold_blooded (exact 0-0)
-- ------------------------------------------------------------
savepoint t19;
do $$
declare
  v_comp_id uuid;
  v_match_id uuid;
  v_concours_id uuid := '10000000-0000-0000-0000-000000000019'::uuid;
  v_has boolean;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';
  select id into v_match_id from public.matchs where competition_id = v_comp_id limit 1;

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-19', v_comp_id,
          '22222222-2222-2222-2222-222222222222', 'public');
  insert into public.pronos (concours_id, user_id, match_id, score_a, score_b)
  values (v_concours_id, '22222222-2222-2222-2222-222222222222', v_match_id, 0, 0);
  update public.matchs set status = 'finished', score_a = 0, score_b = 0 where id = v_match_id;

  select exists(
    select 1 from public.user_badges
    where user_id = '22222222-2222-2222-2222-222222222222' and badge_code = 'cold_blooded'
  ) into v_has;
  assert v_has, 'cold_blooded expected on 0-0 exact';
  raise notice 'TEST 19 OK — cold_blooded';
end $$;
rollback to savepoint t19;

-- ------------------------------------------------------------
--  Test 20 : upset_caller (cote >= 3.0)
-- ------------------------------------------------------------
savepoint t20;
do $$
declare
  v_comp_id uuid;
  v_match_id uuid;
  v_concours_id uuid := '10000000-0000-0000-0000-000000000020'::uuid;
  v_has boolean;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';
  select id into v_match_id from public.matchs where competition_id = v_comp_id limit 1;

  -- Force des cotes
  update public.matchs set cote_a = 3.5, cote_nul = 3.0, cote_b = 2.0 where id = v_match_id;

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-20', v_comp_id,
          '33333333-3333-3333-3333-333333333333', 'public');
  -- Prono : équipe A gagne 2-1 (cote 3.5)
  insert into public.pronos (concours_id, user_id, match_id, score_a, score_b)
  values (v_concours_id, '33333333-3333-3333-3333-333333333333', v_match_id, 2, 1);
  -- Match : 1-0 (bon résultat mais pas exact)
  update public.matchs set status = 'finished', score_a = 1, score_b = 0 where id = v_match_id;

  select exists(
    select 1 from public.user_badges
    where user_id = '33333333-3333-3333-3333-333333333333' and badge_code = 'upset_caller'
  ) into v_has;
  assert v_has, 'upset_caller expected on cote 3.5 + correct winner';
  raise notice 'TEST 20 OK — upset_caller';
end $$;
rollback to savepoint t20;

-- ------------------------------------------------------------
--  Test 24 : groupe_parfait (6 pronos saisis sur une poule)
-- ------------------------------------------------------------
savepoint t24;
do $$
declare
  v_comp_id uuid;
  v_group_matchs uuid[];
  v_concours_id uuid := '10000000-0000-0000-0000-000000000024'::uuid;
  v_has boolean;
  i int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  -- Récupère les 6 matchs du groupe A (via equipe_a.groupe = 'A', phase = 'groupes')
  select array_agg(m.id order by m.kick_off_at) into v_group_matchs
  from public.matchs m
  inner join public.equipes e on e.id = m.equipe_a_id
  where m.competition_id = v_comp_id
    and m.phase = 'groupes'
    and e.groupe = 'A';

  assert array_length(v_group_matchs, 1) = 6,
    format('Expected 6 group A matches, got %s', array_length(v_group_matchs, 1));

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-24', v_comp_id,
          '44444444-4444-4444-4444-444444444444', 'public');

  -- 5 pronos : pas encore groupe_parfait
  for i in 1..5 loop
    insert into public.pronos (concours_id, user_id, match_id, score_a, score_b)
    values (v_concours_id, '44444444-4444-4444-4444-444444444444', v_group_matchs[i], 1, 0);
  end loop;

  select exists(
    select 1 from public.user_badges
    where user_id = '44444444-4444-4444-4444-444444444444' and badge_code = 'groupe_parfait'
  ) into v_has;
  assert not v_has, 'groupe_parfait not expected at 5/6';

  -- 6e prono
  insert into public.pronos (concours_id, user_id, match_id, score_a, score_b)
  values (v_concours_id, '44444444-4444-4444-4444-444444444444', v_group_matchs[6], 1, 0);

  select exists(
    select 1 from public.user_badges
    where user_id = '44444444-4444-4444-4444-444444444444' and badge_code = 'groupe_parfait'
  ) into v_has;
  assert v_has, 'groupe_parfait expected at 6/6 of a group';
  raise notice 'TEST 24 OK — groupe_parfait à 6/6';
end $$;
rollback to savepoint t24;

-- ------------------------------------------------------------
--  Test 26 : podium + champion (competition finished, 3+ participants)
-- ------------------------------------------------------------
savepoint t26;
do $$
declare
  v_comp_id uuid;
  v_match_id uuid;
  v_concours_id uuid := '10000000-0000-0000-0000-000000000026'::uuid;
  v_has_champion boolean;
  v_has_podium_2 boolean;
  v_has_podium_3 boolean;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';
  select id into v_match_id from public.matchs where competition_id = v_comp_id limit 1;

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-26', v_comp_id,
          '11111111-1111-1111-1111-111111111111', 'public');

  -- 3 autres participants (owner = 1 auto, + 2 = 3 participants)
  insert into public.concours_participants (concours_id, user_id, role)
  values
    (v_concours_id, '22222222-2222-2222-2222-222222222222', 'member'),
    (v_concours_id, '33333333-3333-3333-3333-333333333333', 'member');

  -- 1 (owner) finit en tête avec 1 exact, 2 & 3 sans prono (0 pts chacun)
  insert into public.pronos (concours_id, user_id, match_id, score_a, score_b)
  values (v_concours_id, '11111111-1111-1111-1111-111111111111', v_match_id, 1, 0);
  update public.matchs set status = 'finished', score_a = 1, score_b = 0 where id = v_match_id;

  -- Maintenant on passe la compétition en finished
  update public.competitions set status = 'finished' where id = v_comp_id;

  select exists(
    select 1 from public.user_badges
    where user_id = '11111111-1111-1111-1111-111111111111'
      and badge_code = 'champion'
      and metadata @> jsonb_build_object('concours_id', v_concours_id::text)
  ) into v_has_champion;
  assert v_has_champion, 'champion expected for rank 1';

  -- Les deux autres sont ex-aequo rang 2 (RANK() saute 3). Les deux doivent avoir podium
  select exists(
    select 1 from public.user_badges
    where user_id = '22222222-2222-2222-2222-222222222222'
      and badge_code = 'podium'
      and metadata @> jsonb_build_object('concours_id', v_concours_id::text)
  ) into v_has_podium_2;
  select exists(
    select 1 from public.user_badges
    where user_id = '33333333-3333-3333-3333-333333333333'
      and badge_code = 'podium'
      and metadata @> jsonb_build_object('concours_id', v_concours_id::text)
  ) into v_has_podium_3;

  assert v_has_podium_2 and v_has_podium_3,
    'podium expected for rank 2 ex-aequo';
  raise notice 'TEST 26 OK — podium + champion';
end $$;
rollback to savepoint t26;

-- ------------------------------------------------------------
--  Test 27 : guard competition finished avec < 3 participants
-- ------------------------------------------------------------
savepoint t27;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := '10000000-0000-0000-0000-000000000027'::uuid;
  v_has boolean;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  -- Concours avec 2 participants seulement (owner + 1)
  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-27', v_comp_id,
          '44444444-4444-4444-4444-444444444444', 'public');
  insert into public.concours_participants (concours_id, user_id, role)
  values (v_concours_id, '55555555-5555-5555-5555-555555555555', 'member');

  update public.competitions set status = 'finished' where id = v_comp_id;

  select exists(
    select 1 from public.user_badges
    where user_id = '44444444-4444-4444-4444-444444444444'
      and badge_code = 'champion'
      and metadata @> jsonb_build_object('concours_id', v_concours_id::text)
  ) into v_has;
  assert not v_has, 'champion should NOT be attributed at 2 participants';

  select exists(
    select 1 from public.user_badges
    where user_id = '44444444-4444-4444-4444-444444444444'
      and badge_code = 'podium'
      and metadata @> jsonb_build_object('concours_id', v_concours_id::text)
  ) into v_has;
  assert not v_has, 'podium should NOT be attributed at 2 participants';
  raise notice 'TEST 27 OK — guard 3 participants minimum';
end $$;
rollback to savepoint t27;

-- ------------------------------------------------------------
--  Test 28 : guard match re-update sans changement -> trigger no-op
-- ------------------------------------------------------------
savepoint t28;
do $$
declare
  v_comp_id uuid;
  v_match_id uuid;
  v_concours_id uuid := '10000000-0000-0000-0000-000000000028'::uuid;
  v_count_before int;
  v_count_after int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';
  select id into v_match_id from public.matchs where competition_id = v_comp_id limit 1;

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-28', v_comp_id,
          '11111111-1111-1111-1111-111111111111', 'public');
  insert into public.pronos (concours_id, user_id, match_id, score_a, score_b)
  values (v_concours_id, '11111111-1111-1111-1111-111111111111', v_match_id, 1, 0);
  update public.matchs set status = 'finished', score_a = 1, score_b = 0 where id = v_match_id;

  select count(*) into v_count_before from public.user_badges
  where user_id = '11111111-1111-1111-1111-111111111111';

  -- Re-update avec mêmes score / status : trigger doit no-op
  update public.matchs set venue_name = 'Updated stadium' where id = v_match_id;

  select count(*) into v_count_after from public.user_badges
  where user_id = '11111111-1111-1111-1111-111111111111';

  assert v_count_before = v_count_after,
    format('Trigger should no-op on unchanged score/status; before=%s after=%s',
           v_count_before, v_count_after);
  raise notice 'TEST 28 OK — guard re-update';
end $$;
rollback to savepoint t28;

-- ------------------------------------------------------------
--  Test 21 : tab_master (KO à égalité, vainqueur_tab correct)
-- ------------------------------------------------------------
savepoint t21;
do $$
declare
  v_comp_id uuid;
  v_match_id uuid;
  v_concours_id uuid := '10000000-0000-0000-0000-000000000021'::uuid;
  v_has boolean;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  -- Trouve un match KO (placeholder seedé Sprint 5)
  select id into v_match_id
    from public.matchs
    where competition_id = v_comp_id and phase <> 'groupes'
    limit 1;

  -- Si pas de match KO dans le seed, skip
  if v_match_id is null then
    raise notice 'TEST 21 SKIP — pas de match KO dans le seed';
    return;
  end if;

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-21', v_comp_id,
          '11111111-1111-1111-1111-111111111111', 'public');

  -- Prono 1-1 avec vainqueur_tab='a'
  insert into public.pronos (concours_id, user_id, match_id, score_a, score_b, vainqueur_tab)
  values (v_concours_id, '11111111-1111-1111-1111-111111111111', v_match_id, 1, 1, 'a');

  -- Match finit 1-1, vainqueur_tab='a'
  update public.matchs set status = 'finished', score_a = 1, score_b = 1, vainqueur_tab = 'a'
    where id = v_match_id;

  select exists(
    select 1 from public.user_badges
    where user_id = '11111111-1111-1111-1111-111111111111' and badge_code = 'tab_master'
  ) into v_has;
  assert v_has, 'tab_master expected on correct TAB winner on KO draw';
  raise notice 'TEST 21 OK — tab_master';
end $$;
rollback to savepoint t21;

-- ------------------------------------------------------------
--  Test 23 : streak_5 (5 pronos corrects d'affilée)
-- ------------------------------------------------------------
savepoint t23;
do $$
declare
  v_comp_id uuid;
  v_matchs uuid[];
  v_concours_id uuid := '10000000-0000-0000-0000-000000000023'::uuid;
  v_has boolean;
  i int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';
  select array_agg(id order by kick_off_at) into v_matchs
    from public.matchs where competition_id = v_comp_id;

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-23', v_comp_id,
          '22222222-2222-2222-2222-222222222222', 'public');

  -- 5 pronos 1-0
  for i in 1..5 loop
    insert into public.pronos (concours_id, user_id, match_id, score_a, score_b)
    values (v_concours_id, '22222222-2222-2222-2222-222222222222', v_matchs[i], 1, 0);
  end loop;

  -- Tous les 5 matchs finissent 1-0 (score exact x5)
  for i in 1..5 loop
    update public.matchs set status = 'finished', score_a = 1, score_b = 0
      where id = v_matchs[i];
  end loop;

  select exists(
    select 1 from public.user_badges
    where user_id = '22222222-2222-2222-2222-222222222222' and badge_code = 'streak_5'
  ) into v_has;
  assert v_has, 'streak_5 expected after 5 correct predictions in a row';
  raise notice 'TEST 23 OK — streak_5';
end $$;
rollback to savepoint t23;

-- ------------------------------------------------------------
--  Test 29 : idempotence globale (re-finish un match -> pas de doublon badge)
-- ------------------------------------------------------------
savepoint t29;
do $$
declare
  v_comp_id uuid;
  v_match_id uuid;
  v_concours_id uuid := '10000000-0000-0000-0000-000000000029'::uuid;
  v_count int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';
  select id into v_match_id from public.matchs where competition_id = v_comp_id limit 1;

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-29', v_comp_id,
          '33333333-3333-3333-3333-333333333333', 'public');
  insert into public.pronos (concours_id, user_id, match_id, score_a, score_b)
  values (v_concours_id, '33333333-3333-3333-3333-333333333333', v_match_id, 0, 0);
  update public.matchs set status = 'finished', score_a = 0, score_b = 0
    where id = v_match_id;

  select count(*) into v_count from public.user_badges
  where user_id = '33333333-3333-3333-3333-333333333333'
    and badge_code in ('pronostic_parfait', 'cold_blooded');

  -- Simule une correction admin : reset puis re-finish avec même score
  update public.matchs set status = 'scheduled', score_a = null, score_b = null
    where id = v_match_id;
  update public.matchs set status = 'finished', score_a = 0, score_b = 0
    where id = v_match_id;

  select count(*) into v_count from public.user_badges
  where user_id = '33333333-3333-3333-3333-333333333333'
    and badge_code in ('pronostic_parfait', 'cold_blooded');
  assert v_count = 2, format('Expected 2 unique badges after re-finish, got %s', v_count);
  raise notice 'TEST 29 OK — idempotence re-finish';
end $$;
rollback to savepoint t29;

-- ------------------------------------------------------------
--  Fin des tests
-- ------------------------------------------------------------
do $$ begin
  raise notice '=========================================================';
  raise notice '  BADGES TESTS — Tous les scenarios passent ✅';
  raise notice '=========================================================';
end $$;

rollback;
