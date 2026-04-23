-- =============================================================
--  Tests SQL maison — Notifications jokers (Sprint 8.C.4)
-- =============================================================
--
--  Exécution (DB locale `supabase start` active) :
--    psql postgresql://postgres:postgres@localhost:54322/postgres \
--         -v ON_ERROR_STOP=1 \
--         -f supabase/tests/notifications_jokers.sql
--
--  Principe : BEGIN ... ROLLBACK global, savepoints + ASSERT par
--  scénario. On exerce le trigger `notifications_on_joker_consumed`
--  via le RPC `use_joker` (SECURITY DEFINER) en simulant `auth.uid()`
--  avec `set_config('request.jwt.claim.sub', ...)`.
--
--  Scénarios (10) :
--    Setup     : 3 users + 1 concours jokers_enabled + 2 matchs non-lock.
--    1. CHECK `notifications_type_check` étendu : 'challenge_received' OK
--    2. CHECK `notifications_type_check` étendu : 'gift_received' OK
--    3. challenge consommé → 1 notif 'challenge_received' à la cible
--       avec payload {concours_id, match_id, sender_id, joker_code,
--       stakes=5}
--    4. double_down consommé → 1 notif 'challenge_received' à la cible
--       avec stakes=10
--    5. boost (double) consommé → AUCUNE notif pour personne (pas de
--       target user)
--    6. boussole consommée → AUCUNE notif pour personne (pas de target
--       user)
--    7. gift consommé → EXACTEMENT 1 notif 'gift_received' au
--       destinataire avec payload {concours_id, sender_id,
--       gifted_joker_code}. Pas de doublon déclenché par le "slot
--       offert" (même joueur ne reçoit qu'une seule notif pour le flow).
--    8. challenge sur soi-même (impossible via RPC mais testé en
--       bypass service_role) → aucune notif (guard auto-target)
--    9. seconde UPDATE sur un slot déjà used (pas une transition
--       null → non-null) → aucune notif supplémentaire
--   10. Enum `type` refuse 'unknown_type' (control de l'intégrité CHECK)
-- =============================================================

begin;

-- ------------------------------------------------------------
--  Setup
-- ------------------------------------------------------------

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, encrypted_password,
  created_at, updated_at
) values
  ('b1111111-1111-1111-1111-111111111111'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'nj1@test.local', now(),
   '{}'::jsonb,
   jsonb_build_object('prenom', 'Alice', 'nom', 'Martin'),
   '', now(), now()),
  ('b2222222-2222-2222-2222-222222222222'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'nj2@test.local', now(),
   '{}'::jsonb,
   jsonb_build_object('prenom', 'Bob', 'nom', 'Dupont'),
   '', now(), now()),
  ('b3333333-3333-3333-3333-333333333333'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'nj3@test.local', now(),
   '{}'::jsonb,
   jsonb_build_object('prenom', 'Charlie', 'nom', 'Durand'),
   '', now(), now());

do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := 'cc000000-0000-0000-0000-00000000c001'::uuid;
  v_match_a uuid := 'dd000000-0000-0000-0000-00000000ca01'::uuid;
  v_match_b uuid := 'dd000000-0000-0000-0000-00000000ca02'::uuid;
  v_equipe_a uuid;
  v_equipe_b uuid;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility, jokers_enabled)
  values (v_concours_id, 'Test-notifs-jokers', v_comp_id,
          'b1111111-1111-1111-1111-111111111111', 'public', true);

  insert into public.concours_participants (concours_id, user_id, role)
  values
    (v_concours_id, 'b2222222-2222-2222-2222-222222222222', 'member'),
    (v_concours_id, 'b3333333-3333-3333-3333-333333333333', 'member');

  select id into v_equipe_a from public.equipes where competition_id = v_comp_id order by id limit 1;
  select id into v_equipe_b from public.equipes
    where competition_id = v_comp_id and id <> v_equipe_a order by id limit 1;

  insert into public.matchs (id, competition_id, phase, kick_off_at, equipe_a_id, equipe_b_id)
  values
    (v_match_a, v_comp_id, 'groupes', now() + interval '2 days', v_equipe_a, v_equipe_b),
    (v_match_b, v_comp_id, 'groupes', now() + interval '3 days', v_equipe_a, v_equipe_b);

  raise notice 'SETUP OK — concours + 2 matchs';
end $$;

-- ------------------------------------------------------------
--  Test 1 : CHECK accepte 'challenge_received'
-- ------------------------------------------------------------
savepoint t1;
do $$
begin
  -- push direct via helper
  perform public.push_notification(
    'b2222222-2222-2222-2222-222222222222'::uuid,
    'challenge_received',
    '{"probe": true}'::jsonb
  );
  assert exists (
    select 1 from public.notifications
    where type = 'challenge_received' and user_id = 'b2222222-2222-2222-2222-222222222222'::uuid
  ), 'T1 : notification challenge_received doit être acceptée';
  raise notice 'T1 OK : CHECK accepte challenge_received';
end $$;
rollback to savepoint t1;

-- ------------------------------------------------------------
--  Test 2 : CHECK accepte 'gift_received'
-- ------------------------------------------------------------
savepoint t2;
do $$
begin
  perform public.push_notification(
    'b2222222-2222-2222-2222-222222222222'::uuid,
    'gift_received',
    '{"probe": true}'::jsonb
  );
  assert exists (
    select 1 from public.notifications
    where type = 'gift_received' and user_id = 'b2222222-2222-2222-2222-222222222222'::uuid
  ), 'T2 : notification gift_received doit être acceptée';
  raise notice 'T2 OK : CHECK accepte gift_received';
end $$;
rollback to savepoint t2;

-- ------------------------------------------------------------
--  Test 3 : challenge consommé → 1 notif 'challenge_received' à la cible
-- ------------------------------------------------------------
savepoint t3;
do $$
declare
  v_concours_id uuid := 'cc000000-0000-0000-0000-00000000c001'::uuid;
  v_match_a uuid := 'dd000000-0000-0000-0000-00000000ca01'::uuid;
  v_slot_id uuid;
  v_notif public.notifications%rowtype;
begin
  perform set_config('request.jwt.claim.sub', 'b2222222-2222-2222-2222-222222222222', true);

  select id into v_slot_id
  from public.user_jokers
  where user_id = 'b2222222-2222-2222-2222-222222222222'
    and concours_id = v_concours_id
    and joker_code = 'challenge'
    and used_at is null
  limit 1;

  -- Si le starter pack ne contient pas `challenge`, on le crée de force
  -- (les triggers SECURITY DEFINER ne sont plus en jeu ici : on simule
  -- simplement l'inventaire attendu).
  if v_slot_id is null then
    insert into public.user_jokers (
      user_id, concours_id, joker_code, acquired_from
    ) values (
      'b2222222-2222-2222-2222-222222222222',
      v_concours_id, 'challenge', 'starter'
    ) returning id into v_slot_id;
  end if;

  perform public.use_joker(
    v_slot_id,
    v_match_a,
    'b3333333-3333-3333-3333-333333333333'::uuid,
    null
  );

  select * into v_notif
  from public.notifications
  where user_id = 'b3333333-3333-3333-3333-333333333333'::uuid
    and type = 'challenge_received'
  order by created_at desc
  limit 1;

  assert v_notif.id is not null,
    'T3 : une notif challenge_received doit exister pour la cible';
  assert (v_notif.payload->>'concours_id')::uuid = v_concours_id,
    'T3 : payload.concours_id';
  assert (v_notif.payload->>'match_id')::uuid = v_match_a,
    'T3 : payload.match_id';
  assert (v_notif.payload->>'sender_id')::uuid
         = 'b2222222-2222-2222-2222-222222222222'::uuid,
    'T3 : payload.sender_id';
  assert v_notif.payload->>'joker_code' = 'challenge',
    'T3 : payload.joker_code';
  assert (v_notif.payload->>'stakes')::int = 5,
    'T3 : payload.stakes = 5';

  -- L'émetteur ne doit PAS recevoir de notif
  assert not exists (
    select 1 from public.notifications
    where user_id = 'b2222222-2222-2222-2222-222222222222'::uuid
      and type = 'challenge_received'
  ), 'T3 : l''émetteur ne doit pas être notifié';

  raise notice 'T3 OK : challenge consommé → challenge_received';
end $$;
rollback to savepoint t3;

-- ------------------------------------------------------------
--  Test 4 : double_down → stakes=10
-- ------------------------------------------------------------
savepoint t4;
do $$
declare
  v_concours_id uuid := 'cc000000-0000-0000-0000-00000000c001'::uuid;
  v_match_a uuid := 'dd000000-0000-0000-0000-00000000ca01'::uuid;
  v_slot_id uuid;
  v_notif public.notifications%rowtype;
begin
  perform set_config('request.jwt.claim.sub', 'b2222222-2222-2222-2222-222222222222', true);

  insert into public.user_jokers (user_id, concours_id, joker_code, acquired_from)
  values ('b2222222-2222-2222-2222-222222222222', v_concours_id, 'double_down', 'starter')
  returning id into v_slot_id;

  perform public.use_joker(
    v_slot_id,
    v_match_a,
    'b3333333-3333-3333-3333-333333333333'::uuid,
    null
  );

  select * into v_notif
  from public.notifications
  where user_id = 'b3333333-3333-3333-3333-333333333333'::uuid
    and type = 'challenge_received'
  order by created_at desc limit 1;

  assert v_notif.id is not null, 'T4 : notif challenge_received présente';
  assert v_notif.payload->>'joker_code' = 'double_down',
    'T4 : payload.joker_code = double_down';
  assert (v_notif.payload->>'stakes')::int = 10,
    'T4 : payload.stakes = 10';

  raise notice 'T4 OK : double_down → stakes=10';
end $$;
rollback to savepoint t4;

-- ------------------------------------------------------------
--  Test 5 : boost (double) consommé → AUCUNE notif
-- ------------------------------------------------------------
savepoint t5;
do $$
declare
  v_concours_id uuid := 'cc000000-0000-0000-0000-00000000c001'::uuid;
  v_match_a uuid := 'dd000000-0000-0000-0000-00000000ca01'::uuid;
  v_slot_id uuid;
  v_count_before int;
  v_count_after int;
begin
  perform set_config('request.jwt.claim.sub', 'b2222222-2222-2222-2222-222222222222', true);

  select count(*) into v_count_before from public.notifications;

  select id into v_slot_id
  from public.user_jokers
  where user_id = 'b2222222-2222-2222-2222-222222222222'
    and concours_id = v_concours_id
    and joker_code = 'double'
    and used_at is null
  limit 1;

  perform public.use_joker(v_slot_id, v_match_a, null, null);

  select count(*) into v_count_after from public.notifications
  where type in ('challenge_received', 'gift_received');

  assert v_count_after = 0,
    format('T5 : aucune notif joker-sociale attendue après un boost, vu %s', v_count_after);
  raise notice 'T5 OK : boost → 0 notif sociale';
end $$;
rollback to savepoint t5;

-- ------------------------------------------------------------
--  Test 6 : boussole consommée → AUCUNE notif sociale
-- ------------------------------------------------------------
savepoint t6;
do $$
declare
  v_concours_id uuid := 'cc000000-0000-0000-0000-00000000c001'::uuid;
  v_match_a uuid := 'dd000000-0000-0000-0000-00000000ca01'::uuid;
  v_slot_id uuid;
  v_count int;
begin
  perform set_config('request.jwt.claim.sub', 'b2222222-2222-2222-2222-222222222222', true);

  insert into public.user_jokers (user_id, concours_id, joker_code, acquired_from)
  values ('b2222222-2222-2222-2222-222222222222', v_concours_id, 'boussole', 'starter')
  returning id into v_slot_id;

  perform public.use_joker(v_slot_id, v_match_a, null, null);

  select count(*) into v_count from public.notifications
  where type in ('challenge_received', 'gift_received');

  assert v_count = 0,
    format('T6 : aucune notif sociale après boussole, vu %s', v_count);
  raise notice 'T6 OK : boussole → 0 notif sociale';
end $$;
rollback to savepoint t6;

-- ------------------------------------------------------------
--  Test 7 : gift consommé → EXACTEMENT 1 notif gift_received
-- ------------------------------------------------------------
savepoint t7;
do $$
declare
  v_concours_id uuid := 'cc000000-0000-0000-0000-00000000c001'::uuid;
  v_gift_slot uuid;
  v_triple_slot uuid;
  v_count_gift int;
  v_count_challenge int;
  v_notif public.notifications%rowtype;
begin
  perform set_config('request.jwt.claim.sub', 'b2222222-2222-2222-2222-222222222222', true);

  -- Assure qu'on a un 'gift' + un 'triple' à offrir
  insert into public.user_jokers (user_id, concours_id, joker_code, acquired_from)
  values
    ('b2222222-2222-2222-2222-222222222222', v_concours_id, 'gift', 'starter'),
    ('b2222222-2222-2222-2222-222222222222', v_concours_id, 'triple', 'starter')
  returning id into v_gift_slot;  -- récupère seulement le premier (gift)

  select id into v_gift_slot
  from public.user_jokers
  where user_id = 'b2222222-2222-2222-2222-222222222222'
    and concours_id = v_concours_id
    and joker_code = 'gift'
    and used_at is null
  limit 1;

  select id into v_triple_slot
  from public.user_jokers
  where user_id = 'b2222222-2222-2222-2222-222222222222'
    and concours_id = v_concours_id
    and joker_code = 'triple'
    and used_at is null
  limit 1;

  perform public.use_joker(
    v_gift_slot,
    null,
    'b3333333-3333-3333-3333-333333333333'::uuid,
    jsonb_build_object('gifted_joker_code', 'triple')
  );

  -- Exactement 1 notif gift_received pour la cible
  select count(*) into v_count_gift
  from public.notifications
  where user_id = 'b3333333-3333-3333-3333-333333333333'::uuid
    and type = 'gift_received';

  assert v_count_gift = 1,
    format('T7 : attendu 1 notif gift_received, vu %s', v_count_gift);

  -- Aucune notif challenge_received (garantit que le "slot offert" du
  -- flow gift ne génère PAS de notif en doublon)
  select count(*) into v_count_challenge
  from public.notifications
  where user_id = 'b3333333-3333-3333-3333-333333333333'::uuid
    and type = 'challenge_received';

  assert v_count_challenge = 0,
    format('T7 : aucune notif challenge_received attendue pour un gift, vu %s', v_count_challenge);

  -- Payload contient concours_id / sender_id / gifted_joker_code
  select * into v_notif
  from public.notifications
  where user_id = 'b3333333-3333-3333-3333-333333333333'::uuid
    and type = 'gift_received'
  order by created_at desc limit 1;

  assert (v_notif.payload->>'concours_id')::uuid = v_concours_id,
    'T7 : payload.concours_id';
  assert (v_notif.payload->>'sender_id')::uuid
         = 'b2222222-2222-2222-2222-222222222222'::uuid,
    'T7 : payload.sender_id';
  assert v_notif.payload->>'gifted_joker_code' = 'triple',
    'T7 : payload.gifted_joker_code';

  raise notice 'T7 OK : gift → 1 notif gift_received, 0 doublon';
end $$;
rollback to savepoint t7;

-- ------------------------------------------------------------
--  Test 8 : auto-target (bypass service_role) → aucune notif
-- ------------------------------------------------------------
--  On simule un UPDATE direct bypass RPC (ex : service_role ou script
--  d'admin qui force used_on_target_user_id = user_id lui-même).
--  Le trigger doit détecter et skipper.
savepoint t8;
do $$
declare
  v_concours_id uuid := 'cc000000-0000-0000-0000-00000000c001'::uuid;
  v_match_a uuid := 'dd000000-0000-0000-0000-00000000ca01'::uuid;
  v_slot_id uuid;
  v_count int;
begin
  insert into public.user_jokers (user_id, concours_id, joker_code, acquired_from)
  values ('b2222222-2222-2222-2222-222222222222', v_concours_id, 'challenge', 'starter')
  returning id into v_slot_id;

  update public.user_jokers
  set used_at = now(),
      used_on_match_id = v_match_a,
      used_on_target_user_id = 'b2222222-2222-2222-2222-222222222222'::uuid,
      used_payload = jsonb_build_object('stakes', 5)
  where id = v_slot_id;

  select count(*) into v_count from public.notifications
  where type in ('challenge_received', 'gift_received');

  assert v_count = 0,
    format('T8 : aucune notif sur auto-target, vu %s', v_count);

  raise notice 'T8 OK : auto-target → 0 notif (guard défensif)';
end $$;
rollback to savepoint t8;

-- ------------------------------------------------------------
--  Test 9 : seconde UPDATE sur slot déjà used → aucune notif additionnelle
-- ------------------------------------------------------------
savepoint t9;
do $$
declare
  v_concours_id uuid := 'cc000000-0000-0000-0000-00000000c001'::uuid;
  v_match_a uuid := 'dd000000-0000-0000-0000-00000000ca01'::uuid;
  v_match_b uuid := 'dd000000-0000-0000-0000-00000000ca02'::uuid;
  v_slot_id uuid;
  v_count_before int;
  v_count_after int;
begin
  perform set_config('request.jwt.claim.sub', 'b2222222-2222-2222-2222-222222222222', true);

  insert into public.user_jokers (user_id, concours_id, joker_code, acquired_from)
  values ('b2222222-2222-2222-2222-222222222222', v_concours_id, 'challenge', 'starter')
  returning id into v_slot_id;

  perform public.use_joker(
    v_slot_id,
    v_match_a,
    'b3333333-3333-3333-3333-333333333333'::uuid,
    null
  );

  select count(*) into v_count_before from public.notifications
  where user_id = 'b3333333-3333-3333-3333-333333333333'::uuid
    and type = 'challenge_received';

  -- UPDATE sans transition null→non-null (used_at déjà set)
  -- On reroute simplement le slot sur un autre match pour simuler
  -- un script d'admin qui retouche ces colonnes. Le trigger ne doit
  -- PAS repousser.
  update public.user_jokers
  set used_on_match_id = v_match_b
  where id = v_slot_id;

  select count(*) into v_count_after from public.notifications
  where user_id = 'b3333333-3333-3333-3333-333333333333'::uuid
    and type = 'challenge_received';

  assert v_count_after = v_count_before,
    format('T9 : aucune notif additionnelle attendue, avant=%s après=%s',
           v_count_before, v_count_after);

  raise notice 'T9 OK : seconde UPDATE → pas de re-notify';
end $$;
rollback to savepoint t9;

-- ------------------------------------------------------------
--  Test 10 : enum strict (valeur inconnue refusée)
-- ------------------------------------------------------------
savepoint t10;
do $$
declare
  v_rejected bool := false;
begin
  begin
    perform public.push_notification(
      'b2222222-2222-2222-2222-222222222222'::uuid,
      'unknown_type',
      '{}'::jsonb
    );
  exception when check_violation then
    v_rejected := true;
  end;

  assert v_rejected,
    'T10 : le CHECK doit rejeter une valeur type non énumérée';

  raise notice 'T10 OK : enum strict refuse unknown_type';
end $$;
rollback to savepoint t10;

rollback;
