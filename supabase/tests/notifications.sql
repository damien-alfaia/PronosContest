-- =============================================================
--  Tests SQL maison — Notifications in-app (Sprint 6.C)
-- =============================================================
--
--  Exécution (DB locale `supabase start` active) :
--    psql postgresql://postgres:postgres@localhost:54322/postgres \
--         -v ON_ERROR_STOP=1 \
--         -f supabase/tests/notifications.sql
--
--  Principe : BEGIN ... ROLLBACK global, chaque scénario en
--  `do $$ ... end $$` avec ASSERT. `savepoint` + `rollback to
--  savepoint` isolent chaque scénario pour permettre aux suivants
--  de repartir d'un état propre.
--
--  Portée des tests : structure (table, colonnes, indexes,
--  policies, publication), contraintes (CHECK type / payload,
--  immutabilité column-level), et chacun des 4 triggers métier
--  (match_finished, badge_earned, participant_joined, chat_mention).
--
--  Scénarios :
--    Setup : 5 users + 1 concours + 1 match
--    1.  Table & colonnes présentes
--    2.  CHECK type enum (valeur inconnue rejetée)
--    3.  CHECK payload is object (tableau rejeté)
--    4.  Immutabilité column-level : title/body/payload NON mutables
--        sur UPDATE, read_at OUI mutable
--    5.  FK cascade on auth.users DELETE
--    6.  Indexes : user_created_idx + partial user_unread_idx
--    7.  Policies RLS : 1 SELECT + 1 UPDATE + 0 INSERT/DELETE
--    8.  Publication supabase_realtime étendue
--    9.  push_notification helper : insertion OK
--    10. Trigger match_finished : N notifs pour N participants
--    11. Trigger match_finished : guard re-update (pas de double notif)
--    12. Trigger match_finished : guard scores null (pas de notif)
--    13. Trigger badge_earned : 1 notif à l'insert du user_badge
--    14. Trigger participant_joined : skip role=admin (owner self-add)
--    15. Trigger participant_joined : skip si user=owner
--    16. Trigger participant_joined : notif owner quand un autre join
--    17. Trigger chat_mention : match unique via prénom → 1 notif
--    18. Trigger chat_mention : ambiguïté prénom (2 Alices) → skip
--    19. Trigger chat_mention : self-mention (prénom + full-name) → skip
--    20. Trigger chat_mention : dédup multi-mention → 1 seule notif
--    21. Trigger chat_mention : typo → 0 notif
--    22. Trigger chat_mention : full-name "@Prénom Nom" → 1 notif
--    23. Trigger chat_mention : full-name lève l'ambiguïté (2 Alices)
--    24. Trigger chat_mention : full-name + prénom dédupliqués
-- =============================================================

begin;

-- ------------------------------------------------------------
--  Setup : 5 users (dont 2 avec prénoms identiques pour tester
--  l'ambiguïté du trigger chat_mention)
-- ------------------------------------------------------------

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, encrypted_password,
  created_at, updated_at
) values
  ('d1111111-1111-1111-1111-111111111111'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'n1@test.local', now(),
   '{}'::jsonb,
   jsonb_build_object('prenom', 'Alice', 'nom', 'Martin'),
   '', now(), now()),
  ('d2222222-2222-2222-2222-222222222222'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'n2@test.local', now(),
   '{}'::jsonb,
   jsonb_build_object('prenom', 'Bob', 'nom', 'Dupont'),
   '', now(), now()),
  ('d3333333-3333-3333-3333-333333333333'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'n3@test.local', now(),
   '{}'::jsonb,
   jsonb_build_object('prenom', 'Charlie', 'nom', 'Durand'),
   '', now(), now()),
  ('d4444444-4444-4444-4444-444444444444'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'n4@test.local', now(),
   '{}'::jsonb,
   jsonb_build_object('prenom', 'Alice', 'nom', 'Bernard'),
   '', now(), now()),
  ('d5555555-5555-5555-5555-555555555555'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'n5@test.local', now(),
   '{}'::jsonb,
   jsonb_build_object('prenom', 'Eve', 'nom', 'Leclerc'),
   '', now(), now());

-- ------------------------------------------------------------
--  Test 1 : table & colonnes présentes
-- ------------------------------------------------------------
do $$
declare
  v_count int;
begin
  select count(*) into v_count
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'notifications'
     and column_name in (
       'id', 'user_id', 'type', 'title', 'body',
       'payload', 'read_at', 'created_at'
     );
  assert v_count = 8,
    format('Expected 8 columns, got %s', v_count);
  raise notice 'TEST 1 OK — Table notifications avec 8 colonnes';
end $$;

-- ------------------------------------------------------------
--  Test 2 : CHECK type enum (valeur inconnue rejetée)
-- ------------------------------------------------------------
savepoint t2;
do $$
declare
  v_err boolean := false;
begin
  begin
    insert into public.notifications (user_id, type, payload)
    values ('d1111111-1111-1111-1111-111111111111', 'foo_bar_unknown',
            '{}'::jsonb);
  exception when check_violation then
    v_err := true;
  end;
  assert v_err, 'CHECK type: valeur inconnue devrait être rejetée';

  -- Les 4 valeurs valides doivent passer
  insert into public.notifications (user_id, type, payload)
  values
    ('d1111111-1111-1111-1111-111111111111', 'match_result', '{}'::jsonb),
    ('d1111111-1111-1111-1111-111111111111', 'badge_earned', '{}'::jsonb),
    ('d1111111-1111-1111-1111-111111111111', 'concours_new_member', '{}'::jsonb),
    ('d1111111-1111-1111-1111-111111111111', 'chat_mention', '{}'::jsonb);

  raise notice 'TEST 2 OK — CHECK type enum (4 valeurs valides)';
end $$;
rollback to savepoint t2;

-- ------------------------------------------------------------
--  Test 3 : CHECK payload is object (tableau / scalaire rejetés)
-- ------------------------------------------------------------
savepoint t3;
do $$
declare
  v_err_array  boolean := false;
  v_err_scalar boolean := false;
begin
  begin
    insert into public.notifications (user_id, type, payload)
    values ('d1111111-1111-1111-1111-111111111111', 'match_result',
            '[1,2,3]'::jsonb);
  exception when check_violation then
    v_err_array := true;
  end;
  assert v_err_array, 'CHECK payload: tableau devrait être rejeté';

  begin
    insert into public.notifications (user_id, type, payload)
    values ('d1111111-1111-1111-1111-111111111111', 'match_result',
            '42'::jsonb);
  exception when check_violation then
    v_err_scalar := true;
  end;
  assert v_err_scalar, 'CHECK payload: scalaire devrait être rejeté';

  -- Objet vide : OK (valeur par défaut)
  insert into public.notifications (user_id, type, payload)
  values ('d1111111-1111-1111-1111-111111111111', 'match_result',
          '{}'::jsonb);

  raise notice 'TEST 3 OK — CHECK payload is object';
end $$;
rollback to savepoint t3;

-- ------------------------------------------------------------
--  Test 4 : Immutabilité column-level
--    - UPDATE title/body/payload : no-op (trigger restaure OLD)
--    - UPDATE read_at : autorisé
-- ------------------------------------------------------------
savepoint t4;
do $$
declare
  v_id uuid;
  v_title text;
  v_body text;
  v_payload jsonb;
  v_read_at timestamptz;
  v_ts timestamptz := now();
begin
  insert into public.notifications (user_id, type, title, body, payload)
  values ('d1111111-1111-1111-1111-111111111111', 'match_result',
          'original-title', 'original-body',
          jsonb_build_object('match_id', 'abc'))
  returning id into v_id;

  -- Tentative de réécriture title/body/payload
  update public.notifications
     set title = 'HACKED',
         body = 'HACKED',
         payload = jsonb_build_object('injected', true),
         read_at = v_ts
   where id = v_id;

  select title, body, payload, read_at
    into v_title, v_body, v_payload, v_read_at
  from public.notifications where id = v_id;

  assert v_title = 'original-title',
    format('Immutabilité title: expected original-title, got %s', v_title);
  assert v_body = 'original-body',
    format('Immutabilité body: expected original-body, got %s', v_body);
  assert v_payload ->> 'match_id' = 'abc',
    format('Immutabilité payload: expected match_id=abc, got %s',
           v_payload::text);
  assert v_payload ? 'injected' is false,
    'Immutabilité payload: clé "injected" ne devrait pas être présente';
  assert v_read_at = v_ts,
    'read_at devrait avoir été mis à jour';

  raise notice 'TEST 4 OK — Immutabilité column-level (seule read_at mutable)';
end $$;
rollback to savepoint t4;

-- ------------------------------------------------------------
--  Test 5 : FK cascade on DELETE FROM auth.users
-- ------------------------------------------------------------
savepoint t5;
do $$
declare
  v_count int;
begin
  insert into public.notifications (user_id, type, payload)
  values
    ('d2222222-2222-2222-2222-222222222222', 'match_result', '{}'::jsonb),
    ('d2222222-2222-2222-2222-222222222222', 'badge_earned', '{}'::jsonb);

  select count(*) into v_count
    from public.notifications
   where user_id = 'd2222222-2222-2222-2222-222222222222';
  assert v_count >= 2, format('Expected >=2 notifs, got %s', v_count);

  -- DELETE user → cascade
  delete from auth.users
   where id = 'd2222222-2222-2222-2222-222222222222';

  select count(*) into v_count
    from public.notifications
   where user_id = 'd2222222-2222-2222-2222-222222222222';
  assert v_count = 0,
    format('Expected 0 after cascade, got %s', v_count);

  raise notice 'TEST 5 OK — FK cascade on auth.users DELETE';
end $$;
rollback to savepoint t5;

-- ------------------------------------------------------------
--  Test 6 : indexes présents
-- ------------------------------------------------------------
do $$
declare
  v_covering int;
  v_partial int;
begin
  select count(*) into v_covering
    from pg_indexes
   where schemaname = 'public'
     and tablename = 'notifications'
     and indexname = 'notifications_user_created_idx';
  assert v_covering = 1,
    format('Expected 1 covering index, got %s', v_covering);

  select count(*) into v_partial
    from pg_indexes
   where schemaname = 'public'
     and tablename = 'notifications'
     and indexname = 'notifications_user_unread_idx';
  assert v_partial = 1,
    format('Expected 1 partial index, got %s', v_partial);

  raise notice 'TEST 6 OK — Indexes (user_created_idx + user_unread_idx)';
end $$;

-- ------------------------------------------------------------
--  Test 7 : policies RLS
--    - SELECT + UPDATE présentes
--    - INSERT + DELETE absentes (réservés aux triggers SECURITY DEFINER)
-- ------------------------------------------------------------
do $$
declare
  v_select int;
  v_update int;
  v_insert int;
  v_delete int;
begin
  select count(*) into v_select
    from pg_policies
   where schemaname = 'public' and tablename = 'notifications'
     and cmd = 'SELECT';
  select count(*) into v_update
    from pg_policies
   where schemaname = 'public' and tablename = 'notifications'
     and cmd = 'UPDATE';
  select count(*) into v_insert
    from pg_policies
   where schemaname = 'public' and tablename = 'notifications'
     and cmd = 'INSERT';
  select count(*) into v_delete
    from pg_policies
   where schemaname = 'public' and tablename = 'notifications'
     and cmd = 'DELETE';

  assert v_select >= 1,
    format('Expected >=1 SELECT policy, got %s', v_select);
  assert v_update >= 1,
    format('Expected >=1 UPDATE policy, got %s', v_update);
  assert v_insert = 0,
    format('Expected 0 INSERT policy, got %s', v_insert);
  assert v_delete = 0,
    format('Expected 0 DELETE policy, got %s', v_delete);

  raise notice 'TEST 7 OK — Policies SELECT+UPDATE, pas d''INSERT/DELETE';
end $$;

-- ------------------------------------------------------------
--  Test 8 : publication supabase_realtime étendue
-- ------------------------------------------------------------
do $$
declare
  v_count int;
begin
  select count(*) into v_count
    from pg_publication_tables
   where pubname = 'supabase_realtime'
     and schemaname = 'public'
     and tablename = 'notifications';
  assert v_count = 1,
    format('Expected notifications in supabase_realtime, got %s', v_count);
  raise notice 'TEST 8 OK — Publication supabase_realtime contient notifications';
end $$;

-- ------------------------------------------------------------
--  Test 9 : helper push_notification
-- ------------------------------------------------------------
savepoint t9;
do $$
declare
  v_count int;
  v_payload jsonb;
begin
  perform public.push_notification(
    'd3333333-3333-3333-3333-333333333333',
    'match_result',
    jsonb_build_object('foo', 'bar')
  );

  select count(*), max(payload)
    into v_count, v_payload
  from public.notifications
   where user_id = 'd3333333-3333-3333-3333-333333333333'
     and type = 'match_result';

  assert v_count = 1, format('Expected 1 notif, got %s', v_count);
  assert v_payload ->> 'foo' = 'bar',
    format('Expected payload foo=bar, got %s', v_payload::text);

  raise notice 'TEST 9 OK — push_notification helper insère bien';
end $$;
rollback to savepoint t9;

-- ------------------------------------------------------------
--  Test 10 : Trigger match_finished → N notifs pour N participants
-- ------------------------------------------------------------
savepoint t10;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := '30000000-0000-0000-0000-000000000010'::uuid;
  v_match_id uuid := '31000000-0000-0000-0000-000000000010'::uuid;
  v_count int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  -- Concours owné par n1, avec n3, n4 comme participants
  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-notif-10', v_comp_id,
          'd1111111-1111-1111-1111-111111111111', 'public');

  -- n1 auto-ajouté comme admin par trigger handle_new_concours.
  -- Ajoute n3, n4 comme members.
  insert into public.concours_participants (concours_id, user_id, role)
  values
    (v_concours_id, 'd3333333-3333-3333-3333-333333333333', 'member'),
    (v_concours_id, 'd4444444-4444-4444-4444-444444444444', 'member');

  -- Compteur avant : n1/n3/n4 ont déjà reçu leur 'concours_new_member'
  -- éventuelle + rien côté 'match_result'.
  select count(*) into v_count
    from public.notifications
   where type = 'match_result';
  assert v_count = 0,
    format('Pre-update: expected 0 match_result notifs, got %s', v_count);

  -- Insert un match scheduled
  insert into public.matchs (
    id, competition_id, phase, round, kick_off_at,
    equipe_a_id, equipe_b_id, status
  ) values (
    v_match_id, v_comp_id, 'groupes', 1, now() - interval '1 day',
    (select id from public.equipes where fifa_id = 1 limit 1),
    (select id from public.equipes where fifa_id = 2 limit 1),
    'scheduled'
  );

  -- Transition vers 'finished' avec scores
  update public.matchs
     set status = 'finished', score_a = 2, score_b = 1
   where id = v_match_id;

  -- 3 participants (n1 owner + n3 + n4) → 3 notifs match_result
  select count(*) into v_count
    from public.notifications
   where type = 'match_result'
     and payload ->> 'match_id' = v_match_id::text;
  assert v_count = 3,
    format('Expected 3 match_result notifs (3 participants), got %s', v_count);

  raise notice 'TEST 10 OK — Trigger match_finished notifie tous les participants';
end $$;
rollback to savepoint t10;

-- ------------------------------------------------------------
--  Test 11 : Trigger match_finished → guard re-update
--  (un admin corrige un score d'un match déjà finished → pas de re-notif)
-- ------------------------------------------------------------
savepoint t11;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := '30000000-0000-0000-0000-000000000011'::uuid;
  v_match_id uuid := '31000000-0000-0000-0000-000000000011'::uuid;
  v_count_first int;
  v_count_after int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-notif-11', v_comp_id,
          'd1111111-1111-1111-1111-111111111111', 'public');

  insert into public.matchs (
    id, competition_id, phase, round, kick_off_at,
    equipe_a_id, equipe_b_id, status
  ) values (
    v_match_id, v_comp_id, 'groupes', 1, now() - interval '1 day',
    (select id from public.equipes where fifa_id = 1 limit 1),
    (select id from public.equipes where fifa_id = 2 limit 1),
    'scheduled'
  );

  -- 1re transition → doit notifier (1 participant = n1)
  update public.matchs
     set status = 'finished', score_a = 2, score_b = 1
   where id = v_match_id;

  select count(*) into v_count_first
    from public.notifications
   where type = 'match_result'
     and payload ->> 'match_id' = v_match_id::text;
  assert v_count_first = 1,
    format('Première transition: expected 1 notif, got %s', v_count_first);

  -- Correction de score sur un match déjà finished → NE DOIT PAS re-notifier
  update public.matchs
     set score_a = 3
   where id = v_match_id;

  select count(*) into v_count_after
    from public.notifications
   where type = 'match_result'
     and payload ->> 'match_id' = v_match_id::text;
  assert v_count_after = 1,
    format('Re-update: expected 1 notif total (pas de doublon), got %s',
           v_count_after);

  raise notice 'TEST 11 OK — Guard re-update match_finished (pas de spam)';
end $$;
rollback to savepoint t11;

-- ------------------------------------------------------------
--  Test 12 : Trigger match_finished → guard scores null
-- ------------------------------------------------------------
savepoint t12;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := '30000000-0000-0000-0000-000000000012'::uuid;
  v_match_id uuid := '31000000-0000-0000-0000-000000000012'::uuid;
  v_count int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-notif-12', v_comp_id,
          'd1111111-1111-1111-1111-111111111111', 'public');

  insert into public.matchs (
    id, competition_id, phase, round, kick_off_at,
    equipe_a_id, equipe_b_id, status
  ) values (
    v_match_id, v_comp_id, 'groupes', 1, now() - interval '1 day',
    (select id from public.equipes where fifa_id = 1 limit 1),
    (select id from public.equipes where fifa_id = 2 limit 1),
    'scheduled'
  );

  -- Transition vers 'finished' SANS scores → ne doit pas notifier
  update public.matchs
     set status = 'finished'
   where id = v_match_id;

  select count(*) into v_count
    from public.notifications
   where type = 'match_result'
     and payload ->> 'match_id' = v_match_id::text;
  assert v_count = 0,
    format('Expected 0 notif (scores null), got %s', v_count);

  raise notice 'TEST 12 OK — Guard scores null (pas de notif sans résultat)';
end $$;
rollback to savepoint t12;

-- ------------------------------------------------------------
--  Test 13 : Trigger badge_earned → 1 notif au INSERT
-- ------------------------------------------------------------
savepoint t13;
do $$
declare
  v_badge_code text;
  v_count int;
  v_payload jsonb;
begin
  -- Prend n'importe quel badge existant du catalogue (ex: rookie)
  select code into v_badge_code from public.badges order by sort_order limit 1;
  assert v_badge_code is not null,
    'Prérequis: au moins 1 badge dans le catalogue';

  insert into public.user_badges (user_id, badge_code, metadata)
  values ('d3333333-3333-3333-3333-333333333333', v_badge_code,
          jsonb_build_object('source', 'manual-test'));

  select count(*), max(payload)
    into v_count, v_payload
  from public.notifications
   where user_id = 'd3333333-3333-3333-3333-333333333333'
     and type = 'badge_earned';

  assert v_count = 1, format('Expected 1 notif badge_earned, got %s', v_count);
  assert v_payload ->> 'badge_code' = v_badge_code,
    format('Expected badge_code=%s in payload, got %s',
           v_badge_code, v_payload::text);

  raise notice 'TEST 13 OK — Trigger badge_earned notifie 1 fois';
end $$;
rollback to savepoint t13;

-- ------------------------------------------------------------
--  Test 14 : Trigger participant_joined → skip role=admin
--  (cas owner self-add lors du trigger handle_new_concours)
-- ------------------------------------------------------------
savepoint t14;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := '30000000-0000-0000-0000-000000000014'::uuid;
  v_count int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  -- Création : le trigger handle_new_concours auto-insère owner en admin
  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-notif-14', v_comp_id,
          'd1111111-1111-1111-1111-111111111111', 'public');

  -- Aucune notif concours_new_member ne devrait avoir été créée pour n1
  select count(*) into v_count
    from public.notifications
   where user_id = 'd1111111-1111-1111-1111-111111111111'
     and type = 'concours_new_member'
     and payload ->> 'concours_id' = v_concours_id::text;
  assert v_count = 0,
    format('Expected 0 notif (owner self-add admin), got %s', v_count);

  raise notice 'TEST 14 OK — Skip role=admin (pas de notif pour owner self-add)';
end $$;
rollback to savepoint t14;

-- ------------------------------------------------------------
--  Test 15 : Trigger participant_joined → skip si user=owner
--  (cas où l'owner se réajoute manuellement en member, edge case)
-- ------------------------------------------------------------
savepoint t15;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := '30000000-0000-0000-0000-000000000015'::uuid;
  v_count int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-notif-15', v_comp_id,
          'd1111111-1111-1111-1111-111111111111', 'public');

  -- DELETE le row admin auto-créé pour pouvoir ré-insérer en member
  delete from public.concours_participants
   where concours_id = v_concours_id
     and user_id = 'd1111111-1111-1111-1111-111111111111';

  -- Edge case : owner se réinscrit en member
  insert into public.concours_participants (concours_id, user_id, role)
  values (v_concours_id, 'd1111111-1111-1111-1111-111111111111', 'member');

  select count(*) into v_count
    from public.notifications
   where type = 'concours_new_member'
     and payload ->> 'concours_id' = v_concours_id::text;
  assert v_count = 0,
    format('Expected 0 notif (new_user=owner), got %s', v_count);

  raise notice 'TEST 15 OK — Skip si new_user_id = owner_id';
end $$;
rollback to savepoint t15;

-- ------------------------------------------------------------
--  Test 16 : Trigger participant_joined → notif à l'owner
-- ------------------------------------------------------------
savepoint t16;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := '30000000-0000-0000-0000-000000000016'::uuid;
  v_count int;
  v_payload jsonb;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-notif-16', v_comp_id,
          'd1111111-1111-1111-1111-111111111111', 'public');

  -- n3 rejoint le concours (member)
  insert into public.concours_participants (concours_id, user_id, role)
  values (v_concours_id, 'd3333333-3333-3333-3333-333333333333', 'member');

  select count(*), max(payload)
    into v_count, v_payload
  from public.notifications
   where user_id = 'd1111111-1111-1111-1111-111111111111'
     and type = 'concours_new_member'
     and payload ->> 'concours_id' = v_concours_id::text;

  assert v_count = 1,
    format('Expected 1 notif à l''owner, got %s', v_count);
  assert v_payload ->> 'new_user_id' = 'd3333333-3333-3333-3333-333333333333',
    format('Expected new_user_id=n3, got %s', v_payload::text);
  assert v_payload ->> 'concours_nom' = 'Test-notif-16',
    format('Expected concours_nom, got %s', v_payload::text);

  raise notice 'TEST 16 OK — Notif owner quand un autre user join';
end $$;
rollback to savepoint t16;

-- ------------------------------------------------------------
--  Test 17 : Trigger chat_mention → match unique via prénom
--  (n1 écrit "@Bob salut" → n2 "Bob Dupont" reçoit 1 notif)
-- ------------------------------------------------------------
savepoint t17;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := '30000000-0000-0000-0000-000000000017'::uuid;
  v_count int;
  v_payload jsonb;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-notif-17', v_comp_id,
          'd1111111-1111-1111-1111-111111111111', 'public');

  insert into public.concours_participants (concours_id, user_id, role)
  values
    (v_concours_id, 'd2222222-2222-2222-2222-222222222222', 'member'),
    (v_concours_id, 'd3333333-3333-3333-3333-333333333333', 'member');

  -- n1 mentionne @Bob (prénom seul, unique dans le concours)
  insert into public.concours_messages (concours_id, user_id, body)
  values (v_concours_id, 'd1111111-1111-1111-1111-111111111111',
          '@Bob salut tu viens ?');

  select count(*), max(payload)
    into v_count, v_payload
  from public.notifications
   where user_id = 'd2222222-2222-2222-2222-222222222222'
     and type = 'chat_mention'
     and payload ->> 'concours_id' = v_concours_id::text;

  assert v_count = 1,
    format('Expected 1 notif chat_mention pour Bob, got %s', v_count);
  assert v_payload ->> 'mentioned_by' = 'd1111111-1111-1111-1111-111111111111',
    format('Expected mentioned_by=n1, got %s', v_payload::text);
  assert v_payload ->> 'token' = 'bob',
    format('Expected token=bob (lowercased), got %s', v_payload::text);
  assert v_payload ->> 'match_type' = 'first_name',
    format('Expected match_type=first_name, got %s', v_payload::text);

  raise notice 'TEST 17 OK — chat_mention match unique via prénom';
end $$;
rollback to savepoint t17;

-- ------------------------------------------------------------
--  Test 18 : Trigger chat_mention → ambiguïté (2 users "Alice")
-- ------------------------------------------------------------
savepoint t18;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := '30000000-0000-0000-0000-000000000018'::uuid;
  v_count int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-notif-18', v_comp_id,
          'd5555555-5555-5555-5555-555555555555', 'public');

  -- n1 = Alice Martin, n4 = Alice Bernard : 2 "Alice" dans le concours
  insert into public.concours_participants (concours_id, user_id, role)
  values
    (v_concours_id, 'd1111111-1111-1111-1111-111111111111', 'member'),
    (v_concours_id, 'd4444444-4444-4444-4444-444444444444', 'member');

  -- n5 mentionne @Alice → ambigu → skip silencieux
  insert into public.concours_messages (concours_id, user_id, body)
  values (v_concours_id, 'd5555555-5555-5555-5555-555555555555',
          '@Alice ?');

  select count(*) into v_count
    from public.notifications
   where type = 'chat_mention'
     and payload ->> 'concours_id' = v_concours_id::text;
  assert v_count = 0,
    format('Expected 0 notif (ambiguïté "Alice"), got %s', v_count);

  raise notice 'TEST 18 OK — chat_mention ambiguïté ignorée (silencieux)';
end $$;
rollback to savepoint t18;

-- ------------------------------------------------------------
--  Test 19 : Trigger chat_mention → self-mention skip
--  (pass 1 full-name + pass 2 prénom : les 2 doivent skip)
-- ------------------------------------------------------------
savepoint t19;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := '30000000-0000-0000-0000-000000000019'::uuid;
  v_count int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-notif-19', v_comp_id,
          'd2222222-2222-2222-2222-222222222222', 'public');

  -- n2 (Bob Dupont) se mentionne lui-même par prénom ET par full-name
  insert into public.concours_messages (concours_id, user_id, body)
  values (v_concours_id, 'd2222222-2222-2222-2222-222222222222',
          '@Bob note pour moi-même, bien à toi @Bob Dupont');

  select count(*) into v_count
    from public.notifications
   where user_id = 'd2222222-2222-2222-2222-222222222222'
     and type = 'chat_mention'
     and payload ->> 'concours_id' = v_concours_id::text;
  assert v_count = 0,
    format('Expected 0 notif (self-mention), got %s', v_count);

  raise notice 'TEST 19 OK — chat_mention self-mention skip (prénom + full-name)';
end $$;
rollback to savepoint t19;

-- ------------------------------------------------------------
--  Test 20 : Trigger chat_mention → dédup "@Bob @Bob"
-- ------------------------------------------------------------
savepoint t20;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := '30000000-0000-0000-0000-000000000020'::uuid;
  v_count int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-notif-20', v_comp_id,
          'd1111111-1111-1111-1111-111111111111', 'public');

  insert into public.concours_participants (concours_id, user_id, role)
  values (v_concours_id, 'd2222222-2222-2222-2222-222222222222', 'member');

  -- n1 mentionne Bob 3 fois dans le même message
  insert into public.concours_messages (concours_id, user_id, body)
  values (v_concours_id, 'd1111111-1111-1111-1111-111111111111',
          '@Bob @bob @BOB trois fois !');

  select count(*) into v_count
    from public.notifications
   where user_id = 'd2222222-2222-2222-2222-222222222222'
     and type = 'chat_mention'
     and payload ->> 'concours_id' = v_concours_id::text;
  assert v_count = 1,
    format('Expected 1 notif (dédup), got %s', v_count);

  raise notice 'TEST 20 OK — chat_mention dédup multiple "@user"';
end $$;
rollback to savepoint t20;

-- ------------------------------------------------------------
--  Test 21 : Trigger chat_mention → typo (@Bobbb) → 0 notif
-- ------------------------------------------------------------
savepoint t21;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := '30000000-0000-0000-0000-000000000021'::uuid;
  v_count int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-notif-21', v_comp_id,
          'd1111111-1111-1111-1111-111111111111', 'public');

  insert into public.concours_participants (concours_id, user_id, role)
  values (v_concours_id, 'd2222222-2222-2222-2222-222222222222', 'member');

  -- n1 tape mal le prénom : aucun participant ne matche "Bobbb"
  insert into public.concours_messages (concours_id, user_id, body)
  values (v_concours_id, 'd1111111-1111-1111-1111-111111111111',
          '@Bobbb typo');

  select count(*) into v_count
    from public.notifications
   where type = 'chat_mention'
     and payload ->> 'concours_id' = v_concours_id::text;
  assert v_count = 0,
    format('Expected 0 notif (typo), got %s', v_count);

  raise notice 'TEST 21 OK — chat_mention typo ignorée';
end $$;
rollback to savepoint t21;

-- ------------------------------------------------------------
--  Test 22 : Trigger chat_mention → full-name "@Prénom Nom"
--  (n1 écrit "@Bob Dupont" → match full_name sur Bob Dupont)
-- ------------------------------------------------------------
savepoint t22;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := '30000000-0000-0000-0000-000000000022'::uuid;
  v_count int;
  v_payload jsonb;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-notif-22', v_comp_id,
          'd1111111-1111-1111-1111-111111111111', 'public');

  insert into public.concours_participants (concours_id, user_id, role)
  values (v_concours_id, 'd2222222-2222-2222-2222-222222222222', 'member');

  -- n1 mentionne @Bob Dupont (pass 1 full-name)
  insert into public.concours_messages (concours_id, user_id, body)
  values (v_concours_id, 'd1111111-1111-1111-1111-111111111111',
          'salut @Bob Dupont tu valides ?');

  select count(*), max(payload)
    into v_count, v_payload
  from public.notifications
   where user_id = 'd2222222-2222-2222-2222-222222222222'
     and type = 'chat_mention'
     and payload ->> 'concours_id' = v_concours_id::text;
  assert v_count = 1,
    format('Expected 1 notif (full-name), got %s', v_count);
  assert v_payload ->> 'match_type' = 'full_name',
    format('Expected match_type=full_name, got %s', v_payload::text);
  assert v_payload ->> 'token' = 'bob dupont',
    format('Expected token=bob dupont, got %s', v_payload::text);

  raise notice 'TEST 22 OK — chat_mention full-name "@Prénom Nom"';
end $$;
rollback to savepoint t22;

-- ------------------------------------------------------------
--  Test 23 : Trigger chat_mention → full-name lève l'ambiguïté
--  (2 Alices : Martin + Bernard. "@Alice Martin" → uniquement n1,
--  pas n4. "@Alice" seul en revanche reste ambigu.)
-- ------------------------------------------------------------
savepoint t23;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := '30000000-0000-0000-0000-000000000023'::uuid;
  v_count_martin int;
  v_count_bernard int;
  v_payload jsonb;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-notif-23', v_comp_id,
          'd5555555-5555-5555-5555-555555555555', 'public');

  -- Martin = d1 ; Bernard = d4
  insert into public.concours_participants (concours_id, user_id, role)
  values
    (v_concours_id, 'd1111111-1111-1111-1111-111111111111', 'member'),
    (v_concours_id, 'd4444444-4444-4444-4444-444444444444', 'member');

  -- n5 mentionne Alice Martin explicitement
  insert into public.concours_messages (concours_id, user_id, body)
  values (v_concours_id, 'd5555555-5555-5555-5555-555555555555',
          'hello @Alice Martin tu valides ?');

  select count(*), max(payload)
    into v_count_martin, v_payload
  from public.notifications
   where user_id = 'd1111111-1111-1111-1111-111111111111'
     and type = 'chat_mention'
     and payload ->> 'concours_id' = v_concours_id::text;
  assert v_count_martin = 1,
    format('Expected 1 notif pour Alice Martin, got %s', v_count_martin);
  assert v_payload ->> 'match_type' = 'full_name',
    format('Expected match_type=full_name, got %s', v_payload::text);

  select count(*) into v_count_bernard
    from public.notifications
   where user_id = 'd4444444-4444-4444-4444-444444444444'
     and type = 'chat_mention'
     and payload ->> 'concours_id' = v_concours_id::text;
  assert v_count_bernard = 0,
    format('Expected 0 notif pour Alice Bernard, got %s', v_count_bernard);

  raise notice 'TEST 23 OK — full-name lève l''ambiguïté (Martin vs Bernard)';
end $$;
rollback to savepoint t23;

-- ------------------------------------------------------------
--  Test 24 : Trigger chat_mention → full-name + prénom dédup
--  (n1 écrit "@Bob Dupont @Bob" dans le même message : 1 seule
--  notif pour n2, priorité full-name).
-- ------------------------------------------------------------
savepoint t24;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := '30000000-0000-0000-0000-000000000024'::uuid;
  v_count int;
  v_payload jsonb;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-notif-24', v_comp_id,
          'd1111111-1111-1111-1111-111111111111', 'public');

  insert into public.concours_participants (concours_id, user_id, role)
  values (v_concours_id, 'd2222222-2222-2222-2222-222222222222', 'member');

  -- Double mention : full-name + prénom pour la même cible
  insert into public.concours_messages (concours_id, user_id, body)
  values (v_concours_id, 'd1111111-1111-1111-1111-111111111111',
          '@Bob Dupont regarde, sinon @Bob ça marche aussi');

  select count(*), max(payload)
    into v_count, v_payload
  from public.notifications
   where user_id = 'd2222222-2222-2222-2222-222222222222'
     and type = 'chat_mention'
     and payload ->> 'concours_id' = v_concours_id::text;
  assert v_count = 1,
    format('Expected 1 notif (dédup full-name + prénom), got %s', v_count);
  -- Pass 1 (full-name) ramasse en premier → c'est le match_type gagnant
  assert v_payload ->> 'match_type' = 'full_name',
    format('Expected match_type=full_name (pass 1 priority), got %s',
           v_payload::text);

  raise notice 'TEST 24 OK — dédup cross-pass (full-name prioritaire)';
end $$;
rollback to savepoint t24;

rollback;
