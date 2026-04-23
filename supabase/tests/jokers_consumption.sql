-- =============================================================
--  Tests SQL maison — Jokers consumption (Sprint 8.B.1)
-- =============================================================
--
--  Exécution (DB locale `supabase start` active) :
--    psql postgresql://postgres:postgres@localhost:54322/postgres \
--         -v ON_ERROR_STOP=1 \
--         -f supabase/tests/jokers_consumption.sql
--
--  Principe : transaction BEGIN ... ROLLBACK. Chaque scénario en
--  DO $$ ... ASSERT ... END $$. Le RPC `use_joker` est SECURITY
--  DEFINER et utilise `auth.uid()` pour autoriser : on simule via
--  `set_config('request.jwt.claim.sub', '<uuid>', true)` au début
--  de chaque test (ou dans le setup partagé).
--
--  Setup partagé (dans la même transaction, pas dans un savepoint) :
--    - 3 users (j1..j3)
--    - Concours sur FIFA WC 2026, jokers_enabled=true, owner=j1
--    - j2, j3 rejoignent → chacun a 3 jokers starter (double / boussole /
--      challenge)
--    - 3 matchs test (unlocked_A, unlocked_B, locked) insérés dans la
--      même compétition
--    - Autre compétition + match pour tester "wrong_competition"
--
--  Scénarios (23) :
--
--    1.  use double → success, used_at/used_on_match_id renseignés
--    2.  use triple → success
--    3.  use safety_net → success
--    4.  non-owner essaie → not_owner
--    5.  slot déjà utilisé → already_used
--    6.  match verrouillé (kick_off passé) → match_locked
--    7.  même slot consommé 2x → already_used (idempotence)
--    8.  double puis triple sur même match → category_already_used_on_match
--    9.  boost sur match d'une autre compétition → target_match_wrong_competition
--    10. boussole : payload {score_a, score_b, count}
--    11. boussole sans pronos : payload {count:0}
--    12. challenge sans target_user → target_user_required
--    13. challenge target non-participant → target_user_not_in_concours
--    14. challenge target=self → target_is_self
--    15. challenge : stakes=5 canonique
--    16. double_down : stakes=10 canonique
--    17. challenge + double_down sur même match → category_already_used_on_match
--    18. gift sans gifted_joker_code → payload_missing_gifted_code
--    19. gift target non-participant → target_user_not_in_concours
--    20. gift target=self → target_is_self
--    21. gift success : 2 slots caller consommés, 1 slot target créé
--    22. cannot_gift_a_gift
--    23. jokers_disabled sur le concours → jokers_disabled
-- =============================================================

begin;

-- ------------------------------------------------------------
--  Setup (partagé par tous les tests, rollback en bloc)
-- ------------------------------------------------------------

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, encrypted_password,
  created_at, updated_at
) values
  ('a1111111-1111-1111-1111-111111111111'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'jc1@test.local', now(),
   '{}'::jsonb, '{}'::jsonb, '', now(), now()),
  ('a2222222-2222-2222-2222-222222222222'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'jc2@test.local', now(),
   '{}'::jsonb, '{}'::jsonb, '', now(), now()),
  ('a3333333-3333-3333-3333-333333333333'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'jc3@test.local', now(),
   '{}'::jsonb, '{}'::jsonb, '', now(), now());

-- Competition principale + concours jokers_enabled
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := 'cc000000-0000-0000-0000-000000000001'::uuid;
  v_other_comp uuid;
  v_equipe_x uuid;
  v_equipe_y uuid;
  v_equipe_a uuid;
  v_equipe_b uuid;
  v_match_a uuid := 'dd000000-0000-0000-0000-0000000000a1'::uuid;
  v_match_b uuid := 'dd000000-0000-0000-0000-0000000000a2'::uuid;
  v_match_locked uuid := 'dd000000-0000-0000-0000-0000000000a3'::uuid;
  v_match_other_comp uuid := 'dd000000-0000-0000-0000-0000000000a4'::uuid;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  -- Concours opt-in jokers (owner = j1, auto-participant via trigger Sprint 2)
  insert into public.concours (id, nom, competition_id, owner_id, visibility, jokers_enabled)
  values (v_concours_id, 'Test-consumption', v_comp_id,
          'a1111111-1111-1111-1111-111111111111', 'public', true);

  -- j2, j3 rejoignent (→ starter pack via trigger)
  insert into public.concours_participants (concours_id, user_id, role)
  values
    (v_concours_id, 'a2222222-2222-2222-2222-222222222222', 'member'),
    (v_concours_id, 'a3333333-3333-3333-3333-333333333333', 'member');

  -- Deux équipes distinctes de la compétition principale pour les matchs test
  select id into v_equipe_a from public.equipes where competition_id = v_comp_id order by id limit 1;
  select id into v_equipe_b from public.equipes
    where competition_id = v_comp_id and id <> v_equipe_a order by id limit 1;

  -- Match A (future = unlocked)
  insert into public.matchs (id, competition_id, phase, kick_off_at, equipe_a_id, equipe_b_id)
  values (v_match_a, v_comp_id, 'groupes', now() + interval '2 days', v_equipe_a, v_equipe_b);

  -- Match B (future = unlocked) — autre match pour les tests qui utilisent 2 matchs
  insert into public.matchs (id, competition_id, phase, kick_off_at, equipe_a_id, equipe_b_id)
  values (v_match_b, v_comp_id, 'groupes', now() + interval '3 days', v_equipe_a, v_equipe_b);

  -- Match locked (kick_off dans le passé)
  insert into public.matchs (id, competition_id, phase, kick_off_at, equipe_a_id, equipe_b_id)
  values (v_match_locked, v_comp_id, 'groupes', now() - interval '1 hour', v_equipe_a, v_equipe_b);

  -- Autre compétition + match pour test "wrong_competition"
  insert into public.competitions (id, code, nom, sport, status, date_debut, date_fin)
  values (
    'cf000000-0000-0000-0000-000000000001'::uuid,
    'test-other-comp', 'Test Other', 'football', 'upcoming',
    (now()::date + 10), (now()::date + 40)
  );
  v_other_comp := 'cf000000-0000-0000-0000-000000000001'::uuid;

  insert into public.equipes (id, competition_id, code, nom) values
    ('ee000000-0000-0000-0000-0000000000e1'::uuid, v_other_comp, 'OX', 'OtherX'),
    ('ee000000-0000-0000-0000-0000000000e2'::uuid, v_other_comp, 'OY', 'OtherY');

  insert into public.matchs (id, competition_id, phase, kick_off_at, equipe_a_id, equipe_b_id)
  values (
    v_match_other_comp, v_other_comp, 'groupes',
    now() + interval '5 days',
    'ee000000-0000-0000-0000-0000000000e1'::uuid,
    'ee000000-0000-0000-0000-0000000000e2'::uuid
  );

  raise notice 'SETUP OK — concours + 3 matchs + autre compétition';
end $$;

-- ------------------------------------------------------------
--  Test 1 : use double → success
-- ------------------------------------------------------------
savepoint t1;
do $$
declare
  v_slot_id uuid;
  v_result public.user_jokers;
begin
  perform set_config('request.jwt.claim.sub',
                     'a1111111-1111-1111-1111-111111111111', true);

  select id into v_slot_id from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and concours_id = 'cc000000-0000-0000-0000-000000000001'
    and joker_code = 'double'
    and used_at is null;

  v_result := public.use_joker(
    v_slot_id,
    'dd000000-0000-0000-0000-0000000000a1',
    null, null
  );

  assert v_result.used_at is not null, 'used_at doit être renseigné';
  assert v_result.used_on_match_id = 'dd000000-0000-0000-0000-0000000000a1',
    'used_on_match_id doit être set';
  assert v_result.used_on_target_user_id is null, 'boost : pas de target_user';
  assert v_result.used_payload is null, 'boost : pas de payload';
  raise notice 'TEST 1 OK — use double success';
end $$;
rollback to savepoint t1;

-- ------------------------------------------------------------
--  Test 2 : use triple → success (on injecte d'abord un slot triple
--  via award_joker, puisque starter pack = double/boussole/challenge)
-- ------------------------------------------------------------
savepoint t2;
do $$
declare
  v_slot_id uuid;
  v_result public.user_jokers;
begin
  perform public.award_joker(
    'a1111111-1111-1111-1111-111111111111',
    'cc000000-0000-0000-0000-000000000001',
    'triple', 'badge'
  );
  perform set_config('request.jwt.claim.sub',
                     'a1111111-1111-1111-1111-111111111111', true);

  select id into v_slot_id from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'triple' and used_at is null;

  v_result := public.use_joker(
    v_slot_id, 'dd000000-0000-0000-0000-0000000000a1', null, null
  );

  assert v_result.used_at is not null, 'triple consommé';
  raise notice 'TEST 2 OK — use triple success';
end $$;
rollback to savepoint t2;

-- ------------------------------------------------------------
--  Test 3 : use safety_net → success
-- ------------------------------------------------------------
savepoint t3;
do $$
declare
  v_slot_id uuid;
  v_result public.user_jokers;
begin
  perform public.award_joker(
    'a1111111-1111-1111-1111-111111111111',
    'cc000000-0000-0000-0000-000000000001',
    'safety_net', 'badge'
  );
  perform set_config('request.jwt.claim.sub',
                     'a1111111-1111-1111-1111-111111111111', true);

  select id into v_slot_id from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'safety_net' and used_at is null;

  v_result := public.use_joker(
    v_slot_id, 'dd000000-0000-0000-0000-0000000000a1', null, null
  );

  assert v_result.used_at is not null, 'safety_net consommé';
  raise notice 'TEST 3 OK — use safety_net success';
end $$;
rollback to savepoint t3;

-- ------------------------------------------------------------
--  Test 4 : non-owner essaie → not_owner
-- ------------------------------------------------------------
savepoint t4;
do $$
declare
  v_slot_id uuid;
  v_msg text;
begin
  -- slot appartenant à j1, caller = j2
  select id into v_slot_id from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'double' and used_at is null;

  perform set_config('request.jwt.claim.sub',
                     'a2222222-2222-2222-2222-222222222222', true);

  begin
    perform public.use_joker(
      v_slot_id, 'dd000000-0000-0000-0000-0000000000a1', null, null
    );
    raise exception 'Should have raised not_owner';
  exception when sqlstate '42501' then
    v_msg := sqlerrm;
    assert v_msg = 'not_owner', format('Expected not_owner, got %s', v_msg);
  end;
  raise notice 'TEST 4 OK — not_owner levé';
end $$;
rollback to savepoint t4;

-- ------------------------------------------------------------
--  Test 5 : slot déjà utilisé → already_used
-- ------------------------------------------------------------
savepoint t5;
do $$
declare
  v_slot_id uuid;
  v_msg text;
begin
  perform set_config('request.jwt.claim.sub',
                     'a1111111-1111-1111-1111-111111111111', true);

  select id into v_slot_id from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'double' and used_at is null;

  -- Première utilisation OK
  perform public.use_joker(
    v_slot_id, 'dd000000-0000-0000-0000-0000000000a1', null, null
  );

  -- Deuxième utilisation du même slot → already_used
  begin
    perform public.use_joker(
      v_slot_id, 'dd000000-0000-0000-0000-0000000000a2', null, null
    );
    raise exception 'Should have raised already_used';
  exception when sqlstate '22023' then
    v_msg := sqlerrm;
    assert v_msg = 'already_used', format('Expected already_used, got %s', v_msg);
  end;
  raise notice 'TEST 5 OK — already_used levé';
end $$;
rollback to savepoint t5;

-- ------------------------------------------------------------
--  Test 6 : match verrouillé → match_locked
-- ------------------------------------------------------------
savepoint t6;
do $$
declare
  v_slot_id uuid;
  v_msg text;
begin
  perform set_config('request.jwt.claim.sub',
                     'a1111111-1111-1111-1111-111111111111', true);

  select id into v_slot_id from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'double' and used_at is null;

  begin
    perform public.use_joker(
      v_slot_id, 'dd000000-0000-0000-0000-0000000000a3', null, null
    );
    raise exception 'Should have raised match_locked';
  exception when sqlstate '22023' then
    v_msg := sqlerrm;
    assert v_msg = 'match_locked', format('Expected match_locked, got %s', v_msg);
  end;
  raise notice 'TEST 6 OK — match_locked levé';
end $$;
rollback to savepoint t6;

-- ------------------------------------------------------------
--  Test 7 : idempotence — relance du même slot déjà consommé
--  (couvert par T5, mais on vérifie explicitement que la clé d'unicité
--  match-code n'est PAS déclenchée pour l'auteur d'un 2e slot même code)
-- ------------------------------------------------------------
savepoint t7;
do $$
declare
  v_slot_a uuid;
  v_slot_b uuid;
  v_msg text;
begin
  perform public.award_joker(
    'a1111111-1111-1111-1111-111111111111',
    'cc000000-0000-0000-0000-000000000001',
    'double', 'badge'
  );
  perform set_config('request.jwt.claim.sub',
                     'a1111111-1111-1111-1111-111111111111', true);

  -- Deux slots 'double' pour j1 (un starter + un badge)
  select id into v_slot_a from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'double' and acquired_from = 'starter' and used_at is null;
  select id into v_slot_b from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'double' and acquired_from = 'badge' and used_at is null;

  -- Consomme le premier sur match A
  perform public.use_joker(
    v_slot_a, 'dd000000-0000-0000-0000-0000000000a1', null, null
  );

  -- Tente de consommer le 2e double sur le MÊME match → viol idx unique partiel
  -- ce sera intercepté comme category_already_used_on_match (check avant insertion)
  begin
    perform public.use_joker(
      v_slot_b, 'dd000000-0000-0000-0000-0000000000a1', null, null
    );
    raise exception 'Should have raised category_already_used_on_match';
  exception when sqlstate '23505' then
    v_msg := sqlerrm;
    assert v_msg = 'category_already_used_on_match',
      format('Expected category_already_used_on_match, got %s', v_msg);
  end;
  raise notice 'TEST 7 OK — double du même code non-empilable sur même match';
end $$;
rollback to savepoint t7;

-- ------------------------------------------------------------
--  Test 8 : category stacking — double puis triple sur même match
-- ------------------------------------------------------------
savepoint t8;
do $$
declare
  v_slot_double uuid;
  v_slot_triple uuid;
  v_msg text;
begin
  perform public.award_joker(
    'a1111111-1111-1111-1111-111111111111',
    'cc000000-0000-0000-0000-000000000001',
    'triple', 'badge'
  );
  perform set_config('request.jwt.claim.sub',
                     'a1111111-1111-1111-1111-111111111111', true);

  select id into v_slot_double from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'double' and used_at is null;
  select id into v_slot_triple from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'triple' and used_at is null;

  -- Consomme double
  perform public.use_joker(
    v_slot_double, 'dd000000-0000-0000-0000-0000000000a1', null, null
  );

  -- Tente triple sur même match → category stacking interdit
  begin
    perform public.use_joker(
      v_slot_triple, 'dd000000-0000-0000-0000-0000000000a1', null, null
    );
    raise exception 'Should have raised category_already_used_on_match';
  exception when sqlstate '23505' then
    v_msg := sqlerrm;
    assert v_msg = 'category_already_used_on_match',
      format('Expected category_already_used_on_match, got %s', v_msg);
  end;
  raise notice 'TEST 8 OK — double + triple sur même match refusé';
end $$;
rollback to savepoint t8;

-- ------------------------------------------------------------
--  Test 9 : boost sur match d'une autre compétition
-- ------------------------------------------------------------
savepoint t9;
do $$
declare
  v_slot_id uuid;
  v_msg text;
begin
  perform set_config('request.jwt.claim.sub',
                     'a1111111-1111-1111-1111-111111111111', true);

  select id into v_slot_id from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'double' and used_at is null;

  begin
    perform public.use_joker(
      v_slot_id, 'dd000000-0000-0000-0000-0000000000a4', null, null
    );
    raise exception 'Should have raised target_match_wrong_competition';
  exception when sqlstate '22023' then
    v_msg := sqlerrm;
    assert v_msg = 'target_match_wrong_competition',
      format('Expected target_match_wrong_competition, got %s', v_msg);
  end;
  raise notice 'TEST 9 OK — boost sur autre compétition refusé';
end $$;
rollback to savepoint t9;

-- ------------------------------------------------------------
--  Test 10 : boussole — payload contient most common score
--  On simule 3 pronos identiques (j1, j2, j3) sur match A, puis j1
--  consomme sa boussole sur ce match.
-- ------------------------------------------------------------
savepoint t10;
do $$
declare
  v_slot_id uuid;
  v_result public.user_jokers;
begin
  insert into public.pronos (concours_id, user_id, match_id, score_a, score_b) values
    ('cc000000-0000-0000-0000-000000000001',
     'a1111111-1111-1111-1111-111111111111',
     'dd000000-0000-0000-0000-0000000000a1', 2, 1),
    ('cc000000-0000-0000-0000-000000000001',
     'a2222222-2222-2222-2222-222222222222',
     'dd000000-0000-0000-0000-0000000000a1', 2, 1),
    ('cc000000-0000-0000-0000-000000000001',
     'a3333333-3333-3333-3333-333333333333',
     'dd000000-0000-0000-0000-0000000000a1', 1, 0);

  perform set_config('request.jwt.claim.sub',
                     'a1111111-1111-1111-1111-111111111111', true);

  select id into v_slot_id from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'boussole' and used_at is null;

  v_result := public.use_joker(
    v_slot_id, 'dd000000-0000-0000-0000-0000000000a1', null, null
  );

  assert v_result.used_at is not null, 'boussole consommée';
  assert (v_result.used_payload ->> 'score_a')::int = 2,
    format('score_a attendu 2, got %s', v_result.used_payload ->> 'score_a');
  assert (v_result.used_payload ->> 'score_b')::int = 1,
    format('score_b attendu 1, got %s', v_result.used_payload ->> 'score_b');
  assert (v_result.used_payload ->> 'count')::int = 2,
    format('count attendu 2, got %s', v_result.used_payload ->> 'count');
  raise notice 'TEST 10 OK — boussole payload agrégé';
end $$;
rollback to savepoint t10;

-- ------------------------------------------------------------
--  Test 11 : boussole sans pronos → payload count=0
-- ------------------------------------------------------------
savepoint t11;
do $$
declare
  v_slot_id uuid;
  v_result public.user_jokers;
begin
  perform set_config('request.jwt.claim.sub',
                     'a1111111-1111-1111-1111-111111111111', true);

  select id into v_slot_id from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'boussole' and used_at is null;

  v_result := public.use_joker(
    v_slot_id, 'dd000000-0000-0000-0000-0000000000a2', null, null
  );

  assert v_result.used_at is not null, 'boussole consommée';
  assert (v_result.used_payload ->> 'count')::int = 0,
    format('count attendu 0, got %s', v_result.used_payload ->> 'count');
  raise notice 'TEST 11 OK — boussole sans pronos = count 0';
end $$;
rollback to savepoint t11;

-- ------------------------------------------------------------
--  Test 12 : challenge sans target_user_id
-- ------------------------------------------------------------
savepoint t12;
do $$
declare
  v_slot_id uuid;
  v_msg text;
begin
  perform set_config('request.jwt.claim.sub',
                     'a1111111-1111-1111-1111-111111111111', true);

  select id into v_slot_id from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'challenge' and used_at is null;

  begin
    perform public.use_joker(
      v_slot_id, 'dd000000-0000-0000-0000-0000000000a1', null, null
    );
    raise exception 'Should have raised target_user_required';
  exception when sqlstate '22023' then
    v_msg := sqlerrm;
    assert v_msg = 'target_user_required',
      format('Expected target_user_required, got %s', v_msg);
  end;
  raise notice 'TEST 12 OK — challenge target_user_required';
end $$;
rollback to savepoint t12;

-- ------------------------------------------------------------
--  Test 13 : challenge target non-participant
-- ------------------------------------------------------------
savepoint t13;
do $$
declare
  v_slot_id uuid;
  v_msg text;
begin
  -- Nouveau user non-participant
  insert into auth.users (
    id, instance_id, aud, role, email, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, encrypted_password,
    created_at, updated_at
  ) values (
    'a9999999-9999-9999-9999-999999999999'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated', 'authenticated', 'jc9@test.local', now(),
    '{}'::jsonb, '{}'::jsonb, '', now(), now()
  );

  perform set_config('request.jwt.claim.sub',
                     'a1111111-1111-1111-1111-111111111111', true);

  select id into v_slot_id from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'challenge' and used_at is null;

  begin
    perform public.use_joker(
      v_slot_id,
      'dd000000-0000-0000-0000-0000000000a1',
      'a9999999-9999-9999-9999-999999999999',
      null
    );
    raise exception 'Should have raised target_user_not_in_concours';
  exception when sqlstate '22023' then
    v_msg := sqlerrm;
    assert v_msg = 'target_user_not_in_concours',
      format('Expected target_user_not_in_concours, got %s', v_msg);
  end;
  raise notice 'TEST 13 OK — target non-participant refusé';
end $$;
rollback to savepoint t13;

-- ------------------------------------------------------------
--  Test 14 : challenge target=self
-- ------------------------------------------------------------
savepoint t14;
do $$
declare
  v_slot_id uuid;
  v_msg text;
begin
  perform set_config('request.jwt.claim.sub',
                     'a1111111-1111-1111-1111-111111111111', true);

  select id into v_slot_id from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'challenge' and used_at is null;

  begin
    perform public.use_joker(
      v_slot_id,
      'dd000000-0000-0000-0000-0000000000a1',
      'a1111111-1111-1111-1111-111111111111',
      null
    );
    raise exception 'Should have raised target_is_self';
  exception when sqlstate '22023' then
    v_msg := sqlerrm;
    assert v_msg = 'target_is_self',
      format('Expected target_is_self, got %s', v_msg);
  end;
  raise notice 'TEST 14 OK — challenge self refusé';
end $$;
rollback to savepoint t14;

-- ------------------------------------------------------------
--  Test 15 : challenge success → stakes=5
-- ------------------------------------------------------------
savepoint t15;
do $$
declare
  v_slot_id uuid;
  v_result public.user_jokers;
begin
  perform set_config('request.jwt.claim.sub',
                     'a1111111-1111-1111-1111-111111111111', true);

  select id into v_slot_id from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'challenge' and used_at is null;

  v_result := public.use_joker(
    v_slot_id,
    'dd000000-0000-0000-0000-0000000000a1',
    'a2222222-2222-2222-2222-222222222222',
    null
  );

  assert v_result.used_at is not null, 'challenge consommé';
  assert v_result.used_on_target_user_id = 'a2222222-2222-2222-2222-222222222222',
    'target_user set';
  assert (v_result.used_payload ->> 'stakes')::int = 5,
    format('stakes attendu 5, got %s', v_result.used_payload ->> 'stakes');
  raise notice 'TEST 15 OK — challenge stakes=5';
end $$;
rollback to savepoint t15;

-- ------------------------------------------------------------
--  Test 16 : double_down success → stakes=10
-- ------------------------------------------------------------
savepoint t16;
do $$
declare
  v_slot_id uuid;
  v_result public.user_jokers;
begin
  perform public.award_joker(
    'a1111111-1111-1111-1111-111111111111',
    'cc000000-0000-0000-0000-000000000001',
    'double_down', 'badge'
  );
  perform set_config('request.jwt.claim.sub',
                     'a1111111-1111-1111-1111-111111111111', true);

  select id into v_slot_id from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'double_down' and used_at is null;

  v_result := public.use_joker(
    v_slot_id,
    'dd000000-0000-0000-0000-0000000000a1',
    'a2222222-2222-2222-2222-222222222222',
    null
  );

  assert (v_result.used_payload ->> 'stakes')::int = 10,
    format('stakes attendu 10, got %s', v_result.used_payload ->> 'stakes');
  raise notice 'TEST 16 OK — double_down stakes=10';
end $$;
rollback to savepoint t16;

-- ------------------------------------------------------------
--  Test 17 : challenge + double_down sur même match
-- ------------------------------------------------------------
savepoint t17;
do $$
declare
  v_slot_chal uuid;
  v_slot_dd uuid;
  v_msg text;
begin
  perform public.award_joker(
    'a1111111-1111-1111-1111-111111111111',
    'cc000000-0000-0000-0000-000000000001',
    'double_down', 'badge'
  );
  perform set_config('request.jwt.claim.sub',
                     'a1111111-1111-1111-1111-111111111111', true);

  select id into v_slot_chal from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'challenge' and used_at is null;
  select id into v_slot_dd from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'double_down' and used_at is null;

  -- Consomme challenge
  perform public.use_joker(
    v_slot_chal,
    'dd000000-0000-0000-0000-0000000000a1',
    'a2222222-2222-2222-2222-222222222222',
    null
  );

  -- Tente double_down sur même match → category stacking
  begin
    perform public.use_joker(
      v_slot_dd,
      'dd000000-0000-0000-0000-0000000000a1',
      'a3333333-3333-3333-3333-333333333333',
      null
    );
    raise exception 'Should have raised category_already_used_on_match';
  exception when sqlstate '23505' then
    v_msg := sqlerrm;
    assert v_msg = 'category_already_used_on_match',
      format('Expected category_already_used_on_match, got %s', v_msg);
  end;
  raise notice 'TEST 17 OK — challenge + double_down refusé';
end $$;
rollback to savepoint t17;

-- ------------------------------------------------------------
--  Test 18 : gift sans gifted_joker_code
-- ------------------------------------------------------------
savepoint t18;
do $$
declare
  v_slot_id uuid;
  v_msg text;
begin
  perform public.award_joker(
    'a1111111-1111-1111-1111-111111111111',
    'cc000000-0000-0000-0000-000000000001',
    'gift', 'badge'
  );
  perform set_config('request.jwt.claim.sub',
                     'a1111111-1111-1111-1111-111111111111', true);

  select id into v_slot_id from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'gift' and used_at is null;

  begin
    perform public.use_joker(
      v_slot_id,
      null,
      'a2222222-2222-2222-2222-222222222222',
      null
    );
    raise exception 'Should have raised payload_missing_gifted_code';
  exception when sqlstate '22023' then
    v_msg := sqlerrm;
    assert v_msg = 'payload_missing_gifted_code',
      format('Expected payload_missing_gifted_code, got %s', v_msg);
  end;
  raise notice 'TEST 18 OK — gift sans payload refusé';
end $$;
rollback to savepoint t18;

-- ------------------------------------------------------------
--  Test 19 : gift target non-participant
-- ------------------------------------------------------------
savepoint t19;
do $$
declare
  v_slot_id uuid;
  v_msg text;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, encrypted_password,
    created_at, updated_at
  ) values (
    'a8888888-8888-8888-8888-888888888888'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated', 'authenticated', 'jc8@test.local', now(),
    '{}'::jsonb, '{}'::jsonb, '', now(), now()
  );

  perform public.award_joker(
    'a1111111-1111-1111-1111-111111111111',
    'cc000000-0000-0000-0000-000000000001',
    'gift', 'badge'
  );
  perform set_config('request.jwt.claim.sub',
                     'a1111111-1111-1111-1111-111111111111', true);

  select id into v_slot_id from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'gift' and used_at is null;

  begin
    perform public.use_joker(
      v_slot_id,
      null,
      'a8888888-8888-8888-8888-888888888888',
      jsonb_build_object('gifted_joker_code', 'double')
    );
    raise exception 'Should have raised target_user_not_in_concours';
  exception when sqlstate '22023' then
    v_msg := sqlerrm;
    assert v_msg = 'target_user_not_in_concours',
      format('Expected target_user_not_in_concours, got %s', v_msg);
  end;
  raise notice 'TEST 19 OK — gift target non-participant refusé';
end $$;
rollback to savepoint t19;

-- ------------------------------------------------------------
--  Test 20 : gift target=self
-- ------------------------------------------------------------
savepoint t20;
do $$
declare
  v_slot_id uuid;
  v_msg text;
begin
  perform public.award_joker(
    'a1111111-1111-1111-1111-111111111111',
    'cc000000-0000-0000-0000-000000000001',
    'gift', 'badge'
  );
  perform set_config('request.jwt.claim.sub',
                     'a1111111-1111-1111-1111-111111111111', true);

  select id into v_slot_id from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'gift' and used_at is null;

  begin
    perform public.use_joker(
      v_slot_id,
      null,
      'a1111111-1111-1111-1111-111111111111',
      jsonb_build_object('gifted_joker_code', 'double')
    );
    raise exception 'Should have raised target_is_self';
  exception when sqlstate '22023' then
    v_msg := sqlerrm;
    assert v_msg = 'target_is_self',
      format('Expected target_is_self, got %s', v_msg);
  end;
  raise notice 'TEST 20 OK — gift self refusé';
end $$;
rollback to savepoint t20;

-- ------------------------------------------------------------
--  Test 21 : gift success → 2 slots caller consommés, 1 slot target
-- ------------------------------------------------------------
savepoint t21;
do $$
declare
  v_slot_gift uuid;
  v_slot_double uuid;
  v_double_used_at timestamptz;
  v_caller_used_count int;
  v_target_owned_count int;
  v_result public.user_jokers;
begin
  perform public.award_joker(
    'a1111111-1111-1111-1111-111111111111',
    'cc000000-0000-0000-0000-000000000001',
    'gift', 'badge'
  );
  perform set_config('request.jwt.claim.sub',
                     'a1111111-1111-1111-1111-111111111111', true);

  select id into v_slot_gift from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'gift' and used_at is null;
  select id into v_slot_double from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'double' and used_at is null;

  v_result := public.use_joker(
    v_slot_gift,
    null,
    'a2222222-2222-2222-2222-222222222222',
    jsonb_build_object('gifted_joker_code', 'double')
  );

  -- Slot gift consommé
  assert v_result.used_at is not null, 'gift slot consommé';
  assert v_result.used_on_target_user_id = 'a2222222-2222-2222-2222-222222222222',
    'gift target set';
  assert v_result.used_payload ? 'gifted_joker_code', 'payload.gifted_joker_code';

  -- Le slot "double" source aussi consommé
  select used_at into v_double_used_at from public.user_jokers where id = v_slot_double;
  assert v_double_used_at is not null, 'slot double source consommé';

  -- Compte des slots consommés côté caller (au moins 2 : gift + double)
  select count(*) into v_caller_used_count from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and concours_id = 'cc000000-0000-0000-0000-000000000001'
    and used_at is not null;
  assert v_caller_used_count = 2,
    format('Caller doit avoir 2 slots consommés, got %s', v_caller_used_count);

  -- Target a reçu 1 slot 'double' acquired_from='gift', owned
  select count(*) into v_target_owned_count from public.user_jokers
  where user_id = 'a2222222-2222-2222-2222-222222222222'
    and concours_id = 'cc000000-0000-0000-0000-000000000001'
    and joker_code = 'double'
    and acquired_from = 'gift'
    and used_at is null;
  assert v_target_owned_count = 1,
    format('Target doit avoir 1 slot double acquis par gift, got %s', v_target_owned_count);

  raise notice 'TEST 21 OK — gift success : 2 slots caller + 1 slot target';
end $$;
rollback to savepoint t21;

-- ------------------------------------------------------------
--  Test 22 : cannot_gift_a_gift
-- ------------------------------------------------------------
savepoint t22;
do $$
declare
  v_slot_id uuid;
  v_msg text;
begin
  perform public.award_joker(
    'a1111111-1111-1111-1111-111111111111',
    'cc000000-0000-0000-0000-000000000001',
    'gift', 'badge'
  );
  perform set_config('request.jwt.claim.sub',
                     'a1111111-1111-1111-1111-111111111111', true);

  select id into v_slot_id from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'gift' and used_at is null limit 1;

  begin
    perform public.use_joker(
      v_slot_id,
      null,
      'a2222222-2222-2222-2222-222222222222',
      jsonb_build_object('gifted_joker_code', 'gift')
    );
    raise exception 'Should have raised cannot_gift_a_gift';
  exception when sqlstate '22023' then
    v_msg := sqlerrm;
    assert v_msg = 'cannot_gift_a_gift',
      format('Expected cannot_gift_a_gift, got %s', v_msg);
  end;
  raise notice 'TEST 22 OK — cannot_gift_a_gift';
end $$;
rollback to savepoint t22;

-- ------------------------------------------------------------
--  Test 23 : jokers_disabled sur le concours
-- ------------------------------------------------------------
savepoint t23;
do $$
declare
  v_slot_id uuid;
  v_msg text;
begin
  perform set_config('request.jwt.claim.sub',
                     'a1111111-1111-1111-1111-111111111111', true);

  select id into v_slot_id from public.user_jokers
  where user_id = 'a1111111-1111-1111-1111-111111111111'
    and joker_code = 'double' and used_at is null;

  -- Désactive les jokers sur le concours
  update public.concours set jokers_enabled = false
  where id = 'cc000000-0000-0000-0000-000000000001';

  begin
    perform public.use_joker(
      v_slot_id, 'dd000000-0000-0000-0000-0000000000a1', null, null
    );
    raise exception 'Should have raised jokers_disabled';
  exception when sqlstate '22023' then
    v_msg := sqlerrm;
    assert v_msg = 'jokers_disabled',
      format('Expected jokers_disabled, got %s', v_msg);
  end;
  raise notice 'TEST 23 OK — jokers_disabled refusé';
end $$;
rollback to savepoint t23;

rollback;

-- =============================================================
--  FIN DES TESTS JOKERS CONSUMPTION (Sprint 8.B.1)
-- =============================================================
\echo 'Tous les tests jokers_consumption ont passé.'
