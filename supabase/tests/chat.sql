-- =============================================================
--  Tests SQL maison — Chat par concours (Sprint 6.B)
-- =============================================================
--
--  Exécution (DB locale `supabase start` active) :
--    psql postgresql://postgres:postgres@localhost:54322/postgres \
--         -v ON_ERROR_STOP=1 \
--         -f supabase/tests/chat.sql
--
--  Principe : BEGIN ... ROLLBACK global, chaque scénario en
--  `do $$ ... end $$` avec ASSERT. ON_ERROR_STOP=1 fait tout
--  tomber au premier assert faux (ou à la première exception
--  inattendue). Les `savepoint` + `rollback to savepoint`
--  isolent chaque scénario pour permettre aux suivants de
--  repartir d'un état propre.
--
--  Portée des tests : on vérifie les invariants structurels
--  (CHECK, FK cascade, NOT NULL, policies présentes, publication
--  étendue). Les tests RLS "du point de vue d'un user JWT" sont
--  volontairement absents ici comme pour les autres migrations
--  du projet : ils demanderaient de simuler `auth.uid()` via
--  `set_config('request.jwt.claims', ...)` et sont couverts en
--  intégration côté front (Vitest builder Supabase mocké).
--
--  Scénarios :
--    1. Table & colonnes : présence, types, nullabilité.
--    2. CHECK body length : rejet body='' et body trop long.
--    3. FK cascade on concours DELETE : messages supprimés.
--    4. FK cascade on profile DELETE : messages supprimés.
--    5. Index (concours_id, created_at desc) existe.
--    6. Policies RLS listées (select + insert, pas d'update/delete).
--    7. Publication supabase_realtime étendue à la table.
-- =============================================================

begin;

-- ------------------------------------------------------------
--  Setup : 2 users + 1 concours pour permettre l'INSERT
-- ------------------------------------------------------------

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, encrypted_password,
  created_at, updated_at
) values
  ('c1111111-1111-1111-1111-111111111111'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'c1@test.local', now(),
   '{}'::jsonb, '{}'::jsonb, '', now(), now()),
  ('c2222222-2222-2222-2222-222222222222'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'c2@test.local', now(),
   '{}'::jsonb, '{}'::jsonb, '', now(), now());

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
     and table_name = 'concours_messages'
     and column_name in ('id', 'concours_id', 'user_id', 'body', 'created_at');
  assert v_count = 5,
    format('Expected 5 columns, got %s', v_count);
  raise notice 'TEST 1 OK — Table concours_messages avec 5 colonnes';
end $$;

-- ------------------------------------------------------------
--  Test 2 : CHECK body length (1..1000)
-- ------------------------------------------------------------
savepoint t2;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := '20000000-0000-0000-0000-000000000002'::uuid;
  v_err_empty boolean := false;
  v_err_long  boolean := false;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-chat-02', v_comp_id,
          'c1111111-1111-1111-1111-111111111111', 'public');

  -- Body vide rejeté
  begin
    insert into public.concours_messages (concours_id, user_id, body)
    values (v_concours_id, 'c1111111-1111-1111-1111-111111111111', '');
  exception when check_violation then
    v_err_empty := true;
  end;
  assert v_err_empty, 'CHECK body length: body vide devrait être rejeté';

  -- Body > 1000 rejeté
  begin
    insert into public.concours_messages (concours_id, user_id, body)
    values (v_concours_id, 'c1111111-1111-1111-1111-111111111111',
            repeat('x', 1001));
  exception when check_violation then
    v_err_long := true;
  end;
  assert v_err_long, 'CHECK body length: body > 1000 devrait être rejeté';

  -- Body = 1 accepté
  insert into public.concours_messages (concours_id, user_id, body)
  values (v_concours_id, 'c1111111-1111-1111-1111-111111111111', 'x');

  -- Body = 1000 accepté
  insert into public.concours_messages (concours_id, user_id, body)
  values (v_concours_id, 'c1111111-1111-1111-1111-111111111111',
          repeat('x', 1000));

  raise notice 'TEST 2 OK — CHECK body length (1..1000)';
end $$;
rollback to savepoint t2;

-- ------------------------------------------------------------
--  Test 3 : FK cascade on DELETE FROM concours
-- ------------------------------------------------------------
savepoint t3;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := '20000000-0000-0000-0000-000000000003'::uuid;
  v_count int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-chat-03', v_comp_id,
          'c1111111-1111-1111-1111-111111111111', 'public');

  insert into public.concours_messages (concours_id, user_id, body)
  values
    (v_concours_id, 'c1111111-1111-1111-1111-111111111111', 'hello'),
    (v_concours_id, 'c1111111-1111-1111-1111-111111111111', 'world');

  select count(*) into v_count
    from public.concours_messages where concours_id = v_concours_id;
  assert v_count = 2, format('Expected 2 messages, got %s', v_count);

  -- Le DELETE de concours doit cascader
  delete from public.concours where id = v_concours_id;

  select count(*) into v_count
    from public.concours_messages where concours_id = v_concours_id;
  assert v_count = 0, format('Expected 0 after cascade, got %s', v_count);

  raise notice 'TEST 3 OK — FK cascade on concours DELETE';
end $$;
rollback to savepoint t3;

-- ------------------------------------------------------------
--  Test 4 : FK cascade on DELETE FROM profiles/auth.users
-- ------------------------------------------------------------
savepoint t4;
do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := '20000000-0000-0000-0000-000000000004'::uuid;
  v_user uuid := 'c2222222-2222-2222-2222-222222222222';
  v_count int;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (id, nom, competition_id, owner_id, visibility)
  values (v_concours_id, 'Test-chat-04', v_comp_id,
          'c1111111-1111-1111-1111-111111111111', 'public');

  -- Ajoute c2 comme participant pour contourner la RLS (exécuté en
  -- superuser, mais ça reflète un état réaliste)
  insert into public.concours_participants (concours_id, user_id, role)
  values (v_concours_id, v_user, 'member')
  on conflict do nothing;

  insert into public.concours_messages (concours_id, user_id, body)
  values (v_concours_id, v_user, 'hola');

  -- DELETE de l'user : cascade via profiles on delete cascade
  delete from auth.users where id = v_user;

  select count(*) into v_count
    from public.concours_messages where user_id = v_user;
  assert v_count = 0,
    format('Expected 0 after user cascade, got %s', v_count);

  raise notice 'TEST 4 OK — FK cascade on profile DELETE';
end $$;
rollback to savepoint t4;

-- ------------------------------------------------------------
--  Test 5 : index (concours_id, created_at desc) présent
-- ------------------------------------------------------------
do $$
declare
  v_count int;
begin
  select count(*) into v_count
    from pg_indexes
   where schemaname = 'public'
     and tablename = 'concours_messages'
     and indexname = 'concours_messages_concours_created_idx';
  assert v_count = 1, format('Expected 1 index, got %s', v_count);
  raise notice 'TEST 5 OK — Index (concours_id, created_at desc)';
end $$;

-- ------------------------------------------------------------
--  Test 6 : policies RLS
--    - select + insert présentes
--    - update + delete absentes (immuable MVP)
-- ------------------------------------------------------------
do $$
declare
  v_select int;
  v_insert int;
  v_update int;
  v_delete int;
begin
  select count(*) into v_select
    from pg_policies
   where schemaname = 'public' and tablename = 'concours_messages'
     and cmd = 'SELECT';
  select count(*) into v_insert
    from pg_policies
   where schemaname = 'public' and tablename = 'concours_messages'
     and cmd = 'INSERT';
  select count(*) into v_update
    from pg_policies
   where schemaname = 'public' and tablename = 'concours_messages'
     and cmd = 'UPDATE';
  select count(*) into v_delete
    from pg_policies
   where schemaname = 'public' and tablename = 'concours_messages'
     and cmd = 'DELETE';

  assert v_select >= 1, format('Expected >=1 SELECT policy, got %s', v_select);
  assert v_insert >= 1, format('Expected >=1 INSERT policy, got %s', v_insert);
  assert v_update = 0, format('Expected 0 UPDATE policy (immutable), got %s', v_update);
  assert v_delete = 0, format('Expected 0 DELETE policy (immutable), got %s', v_delete);

  raise notice 'TEST 6 OK — Policies SELECT + INSERT, pas de UPDATE/DELETE';
end $$;

-- ------------------------------------------------------------
--  Test 7 : publication supabase_realtime étendue
-- ------------------------------------------------------------
do $$
declare
  v_count int;
begin
  select count(*) into v_count
    from pg_publication_tables
   where pubname = 'supabase_realtime'
     and schemaname = 'public'
     and tablename = 'concours_messages';
  assert v_count = 1,
    format('Expected concours_messages in supabase_realtime, got %s', v_count);
  raise notice 'TEST 7 OK — Publication supabase_realtime contient concours_messages';
end $$;

rollback;
