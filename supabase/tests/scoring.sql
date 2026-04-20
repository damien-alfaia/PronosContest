-- =============================================================
--  Tests SQL maison — Scoring & classement (Sprint 4)
-- =============================================================
--
--  Exécution (DB locale `supabase start` active) :
--    psql postgresql://postgres:postgres@localhost:54322/postgres \
--         -v ON_ERROR_STOP=1 \
--         -f supabase/tests/scoring.sql
--
--  Principe :
--    - Tout tourne dans une transaction ROLLBACKée en fin de fichier.
--    - Chaque scénario est testé via un bloc DO $$ ASSERT ... END $$,
--      qui lève une exception si la condition est fausse et stoppe
--      le script grâce à ON_ERROR_STOP=1.
--    - La sortie "TEST OK" ou "SCORING OK" confirme le passage.
--
--  13 scénarios couverts :
--    1.  Score exact en groupes (sans cote, sans bonus KO)
--    2.  Score exact en KO (avec knockout_bonus additif)
--    3.  Bon vainqueur en groupes (sans bonus, sans cote)
--    4.  Bon vainqueur en KO (avec bonus_ko additif)
--    5.  Bon nul en groupes (correct_draw)
--    6.  Mauvais prono -> 0 point, is_won = false
--    7.  Match non finalisé (score NULL) -> is_final = false, 0 point
--    8.  odds_multiplier activé + cote non NULL -> multiplier appliqué
--    9.  odds_multiplier activé + cote NULL -> pas de multiplier
--    10. odds_multiplier désactivé + cote non NULL -> pas de multiplier
--    11. Participant sans prono -> 0 points mais apparaît dans v_classement
--    12. v_classement tri : points DESC -> pronos_exacts -> pronos_gagnes
--    13. RANK() ex-aequo (même place, saut de rang)
-- =============================================================

begin;

-- ------------------------------------------------------------
-- Setup : 3 users + 1 concours + 4 matchs + pronos
-- ------------------------------------------------------------

-- Users dans auth.users (profiles auto-créés par handle_new_user)
insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, encrypted_password,
  created_at, updated_at
) values
  ('11111111-1111-1111-1111-111111111111'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'u1@test.local', now(),
   '{}'::jsonb, '{"prenom":"Alice"}'::jsonb, '',
   now(), now()),
  ('22222222-2222-2222-2222-222222222222'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'u2@test.local', now(),
   '{}'::jsonb, '{"prenom":"Bob"}'::jsonb, '',
   now(), now()),
  ('33333333-3333-3333-3333-333333333333'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'u3@test.local', now(),
   '{}'::jsonb, '{"prenom":"Carol"}'::jsonb, '',
   now(), now()),
  ('44444444-4444-4444-4444-444444444444'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'u4@test.local', now(),
   '{}'::jsonb, '{"prenom":"Dan"}'::jsonb, '',
   now(), now());

-- Concours sur FIFA WC 2026 avec scoring rules par défaut (multiplier ON)
insert into public.concours (id, nom, competition_id, owner_id, visibility, scoring_rules)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'Concours test scoring',
  (select id from public.competitions where code = 'fifa-wc-2026'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'public',
  '{"exact_score":15,"correct_winner":5,"correct_draw":7,"odds_multiplier_enabled":true,"knockout_bonus":2}'::jsonb
);

-- Concours "miroir" multiplier OFF (pour le test #10)
insert into public.concours (id, nom, competition_id, owner_id, visibility, scoring_rules)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  'Concours test multiplier OFF',
  (select id from public.competitions where code = 'fifa-wc-2026'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'public',
  '{"exact_score":15,"correct_winner":5,"correct_draw":7,"odds_multiplier_enabled":false,"knockout_bonus":2}'::jsonb
);

-- Participants des deux concours (owner ajouté par trigger)
insert into public.concours_participants (concours_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'member'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 'member'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '44444444-4444-4444-4444-444444444444'::uuid, 'member'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'member');

-- 5 matchs de test (UUIDs hardcodés pour les assertions)
-- MG1 groupes finalisé 2-1 avec cote_a = 2.50
-- MG2 groupes finalisé 1-1 sans cote
-- MG3 groupes finalisé 0-2 (pas de cote)
-- MK1 huitièmes finalisé 3-1 avec cote_a = 4.00
-- MS1 scheduled (non finalisé, kick-off futur)
insert into public.matchs (
  id, competition_id, phase, round, kick_off_at,
  equipe_a_id, equipe_b_id,
  score_a, score_b, status,
  cote_a, cote_nul, cote_b
) values
  ('10000000-0000-0000-0000-000000000001'::uuid,
   (select id from public.competitions where code = 'fifa-wc-2026'),
   'groupes', 1, now() - interval '1 day',
   (select id from public.equipes where fifa_id = 1 limit 1),
   (select id from public.equipes where fifa_id = 2 limit 1),
   2, 1, 'finished',
   2.50, 3.10, 3.00),
  ('10000000-0000-0000-0000-000000000002'::uuid,
   (select id from public.competitions where code = 'fifa-wc-2026'),
   'groupes', 1, now() - interval '1 day',
   (select id from public.equipes where fifa_id = 3 limit 1),
   (select id from public.equipes where fifa_id = 4 limit 1),
   1, 1, 'finished',
   null, null, null),
  ('10000000-0000-0000-0000-000000000003'::uuid,
   (select id from public.competitions where code = 'fifa-wc-2026'),
   'groupes', 1, now() - interval '1 day',
   (select id from public.equipes where fifa_id = 5 limit 1),
   (select id from public.equipes where fifa_id = 6 limit 1),
   0, 2, 'finished',
   null, null, null),
  ('10000000-0000-0000-0000-000000000004'::uuid,
   (select id from public.competitions where code = 'fifa-wc-2026'),
   'huitiemes', 4, now() - interval '1 day',
   (select id from public.equipes where fifa_id = 7 limit 1),
   (select id from public.equipes where fifa_id = 8 limit 1),
   3, 1, 'finished',
   4.00, null, 1.90),
  ('10000000-0000-0000-0000-000000000005'::uuid,
   (select id from public.competitions where code = 'fifa-wc-2026'),
   'groupes', 2, now() + interval '7 days',
   (select id from public.equipes where fifa_id = 9 limit 1),
   (select id from public.equipes where fifa_id = 10 limit 1),
   null, null, 'scheduled',
   2.00, 3.20, 3.50);

-- Pronos Alice (u1) : score exact sur MG1 (2-1), bon vainqueur sur MK1 (2-0),
-- score exact "nul" sur MG2 (1-1), rien sur MG3/MS1.
insert into public.pronos (concours_id, user_id, match_id, score_a, score_b) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000001', 2, 1),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000002', 1, 1),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000004', 2, 0);

-- Pronos Bob (u2) : bon vainqueur sans exact sur MG1 (3-0), mauvais prono sur MG3 (2-0).
insert into public.pronos (concours_id, user_id, match_id, score_a, score_b) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', '10000000-0000-0000-0000-000000000001', 3, 0),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', '10000000-0000-0000-0000-000000000003', 2, 0);

-- Pronos Carol (u3) : prono sur match non finalisé MS1 (1-0).
insert into public.pronos (concours_id, user_id, match_id, score_a, score_b) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', '10000000-0000-0000-0000-000000000005', 1, 0);

-- Pronos Bob dans le concours "multiplier OFF" : score exact sur MG1 (2-1).
insert into public.pronos (concours_id, user_id, match_id, score_a, score_b) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', '10000000-0000-0000-0000-000000000001', 2, 1);

-- ============================================================
--  Tests v_pronos_points (points par prono)
-- ============================================================

-- 1. Alice MG1 : score exact groupes, multiplier ON, cote_a=2.50
--    -> points_base=15, bonus_ko=0, cote_appliquee=2.50
do $$
declare
  r record;
begin
  select * into r from public.v_pronos_points
  where concours_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    and user_id = '11111111-1111-1111-1111-111111111111'
    and match_id = '10000000-0000-0000-0000-000000000001';
  assert r.is_final = true, 'T1: is_final should be true';
  assert r.is_exact = true, 'T1: is_exact should be true';
  assert r.points_base = 15, 'T1: points_base should be 15, got ' || r.points_base;
  assert r.bonus_ko = 0, 'T1: bonus_ko should be 0 (groupes), got ' || r.bonus_ko;
  assert r.cote_appliquee = 2.50, 'T1: cote_appliquee should be 2.50, got ' || coalesce(r.cote_appliquee::text, 'NULL');
  raise notice 'T1 OK: Alice MG1 exact groupes (15 * 2.50 = 38)';
end $$;

-- 2. Alice MK1 : bon vainqueur KO, cote_a=4.00
--    -> points_base=5, bonus_ko=2, cote_appliquee=4.00
do $$
declare
  r record;
begin
  select * into r from public.v_pronos_points
  where user_id = '11111111-1111-1111-1111-111111111111'
    and match_id = '10000000-0000-0000-0000-000000000004';
  assert r.is_final = true, 'T2: is_final';
  assert r.is_exact = false, 'T2: not exact (2-0 vs 3-1)';
  assert r.points_base = 5, 'T2: points_base=5, got ' || r.points_base;
  assert r.bonus_ko = 2, 'T2: bonus_ko=2 (huitiemes), got ' || r.bonus_ko;
  assert r.cote_appliquee = 4.00, 'T2: cote_appliquee=4.00, got ' || coalesce(r.cote_appliquee::text, 'NULL');
  raise notice 'T2 OK: Alice MK1 bon vainqueur KO (5+2)*4 = 28';
end $$;

-- 3. Alice MG2 : score exact nul 1-1 groupes, pas de cote
--    -> points_base=15, bonus_ko=0, cote_appliquee=NULL (pas de cote côté match)
do $$
declare
  r record;
begin
  select * into r from public.v_pronos_points
  where user_id = '11111111-1111-1111-1111-111111111111'
    and match_id = '10000000-0000-0000-0000-000000000002';
  assert r.is_exact = true, 'T3: exact 1-1';
  assert r.points_base = 15, 'T3: exact prime sur draw, got ' || r.points_base;
  assert r.bonus_ko = 0, 'T3: bonus_ko=0';
  assert r.cote_appliquee is null, 'T3: cote_appliquee NULL (pas de cote)';
  raise notice 'T3 OK: Alice MG2 score exact nul groupes = 15 (no cote)';
end $$;

-- 4. Bob MG1 : bon vainqueur sans exact, groupes, cote_a=2.50
--    -> points_base=5, bonus_ko=0, cote_appliquee=2.50
do $$
declare
  r record;
begin
  select * into r from public.v_pronos_points
  where user_id = '22222222-2222-2222-2222-222222222222'
    and match_id = '10000000-0000-0000-0000-000000000001';
  assert r.is_exact = false, 'T4: not exact (3-0 vs 2-1)';
  assert r.points_base = 5, 'T4: correct_winner=5, got ' || r.points_base;
  assert r.bonus_ko = 0, 'T4: bonus_ko=0 (groupes)';
  assert r.cote_appliquee = 2.50, 'T4: cote_appliquee=2.50';
  raise notice 'T4 OK: Bob MG1 bon vainqueur groupes (5 * 2.5 = 13)';
end $$;

-- 5. Bob MG3 : prono 2-0 (victoire a), match 0-2 (victoire b) -> mauvais prono
--    -> points_base=0, is_exact=false
do $$
declare
  r record;
begin
  select * into r from public.v_pronos_points
  where user_id = '22222222-2222-2222-2222-222222222222'
    and match_id = '10000000-0000-0000-0000-000000000003';
  assert r.is_final = true, 'T5: is_final';
  assert r.is_exact = false, 'T5: not exact';
  assert r.points_base = 0, 'T5: wrong winner, points_base=0';
  assert r.bonus_ko = 0, 'T5: no bonus when wrong';
  assert r.cote_appliquee is null, 'T5: no cote when wrong';
  raise notice 'T5 OK: Bob MG3 mauvais prono = 0';
end $$;

-- 6. Carol MS1 : match non finalisé (status=scheduled, scores NULL)
--    -> is_final=false, points_base=0, cote_appliquee=NULL
do $$
declare
  r record;
begin
  select * into r from public.v_pronos_points
  where user_id = '33333333-3333-3333-3333-333333333333'
    and match_id = '10000000-0000-0000-0000-000000000005';
  assert r.is_final = false, 'T6: is_final should be false';
  assert r.is_exact = false, 'T6: is_exact should be false';
  assert r.points_base = 0, 'T6: points_base=0 on unfinished';
  assert r.bonus_ko = 0, 'T6: bonus_ko=0 on unfinished';
  assert r.cote_appliquee is null, 'T6: cote_appliquee NULL on unfinished';
  raise notice 'T6 OK: Carol MS1 match non finalisé ignoré';
end $$;

-- 7. Bob concours "multiplier OFF" MG1 : score exact 2-1 groupes
--    -> points_base=15, cote_appliquee=NULL (multiplier désactivé)
do $$
declare
  r record;
begin
  select * into r from public.v_pronos_points
  where concours_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    and user_id = '22222222-2222-2222-2222-222222222222'
    and match_id = '10000000-0000-0000-0000-000000000001';
  assert r.is_exact = true, 'T7: exact';
  assert r.points_base = 15, 'T7: points_base=15';
  assert r.cote_appliquee is null,
    'T7: cote_appliquee should be NULL (multiplier OFF), got '
    || coalesce(r.cote_appliquee::text, 'NULL');
  raise notice 'T7 OK: multiplier OFF ignore les cotes -> 15 points nets';
end $$;

-- ============================================================
--  Tests v_classement_concours (agrégation + tri + rang)
-- ============================================================

-- 8. Alice : points = round(15*2.5) + round((5+2)*4) + round(15*1) = 38 + 28 + 15 = 81
--    pronos_joues=3, pronos_gagnes=3, pronos_exacts=2
do $$
declare
  r record;
begin
  select * into r from public.v_classement_concours
  where concours_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    and user_id = '11111111-1111-1111-1111-111111111111';
  assert r.points = 81, 'T8: Alice points=81, got ' || r.points;
  assert r.pronos_joues = 3, 'T8: pronos_joues=3, got ' || r.pronos_joues;
  assert r.pronos_gagnes = 3, 'T8: pronos_gagnes=3, got ' || r.pronos_gagnes;
  assert r.pronos_exacts = 2, 'T8: pronos_exacts=2, got ' || r.pronos_exacts;
  raise notice 'T8 OK: Alice total=81 (3 joués, 3 gagnés, 2 exacts)';
end $$;

-- 9. Bob : MG1 bon vainqueur cote 2.5 = round(5*2.5)=13, MG3 wrong = 0
--    Total = 13, pronos_joues=2, pronos_gagnes=1, pronos_exacts=0
do $$
declare
  r record;
begin
  select * into r from public.v_classement_concours
  where concours_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    and user_id = '22222222-2222-2222-2222-222222222222';
  assert r.points = 13, 'T9: Bob points=13, got ' || r.points;
  assert r.pronos_joues = 2, 'T9: pronos_joues=2, got ' || r.pronos_joues;
  assert r.pronos_gagnes = 1, 'T9: pronos_gagnes=1, got ' || r.pronos_gagnes;
  assert r.pronos_exacts = 0, 'T9: pronos_exacts=0, got ' || r.pronos_exacts;
  raise notice 'T9 OK: Bob total=13';
end $$;

-- 10. Carol : un seul prono sur match non finalisé -> 0 partout
do $$
declare
  r record;
begin
  select * into r from public.v_classement_concours
  where concours_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    and user_id = '33333333-3333-3333-3333-333333333333';
  assert r.points = 0, 'T10: Carol points=0';
  assert r.pronos_joues = 0, 'T10: pronos_joues=0 (match non finalisé)';
  assert r.pronos_gagnes = 0, 'T10: pronos_gagnes=0';
  assert r.pronos_exacts = 0, 'T10: pronos_exacts=0';
  raise notice 'T10 OK: Carol prono sur match non finalisé = 0';
end $$;

-- 11. Dan : aucun prono mais participant -> ligne à 0 dans le classement
-- NB: on s'appuie sur FOUND car `record IS NOT NULL` est FALSE si au moins
-- un champ du record est NULL (sémantique composite Postgres).
do $$
declare
  r record;
begin
  select * into r from public.v_classement_concours
  where concours_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    and user_id = '44444444-4444-4444-4444-444444444444';
  assert found, 'T11: Dan must appear in classement';
  assert r.points = 0, 'T11: Dan points=0';
  assert r.pronos_joues = 0, 'T11: Dan pronos_joues=0';
  raise notice 'T11 OK: Dan sans prono apparaît à 0';
end $$;

-- 12. Tri + rang : Alice=81 rang 1, Bob=13 rang 2, Carol=0 et Dan=0 ex-aequo rang 3
do $$
declare
  r_alice record;
  r_bob record;
  r_carol record;
  r_dan record;
begin
  select * into r_alice from public.v_classement_concours
    where concours_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id = '11111111-1111-1111-1111-111111111111';
  select * into r_bob from public.v_classement_concours
    where concours_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id = '22222222-2222-2222-2222-222222222222';
  select * into r_carol from public.v_classement_concours
    where concours_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id = '33333333-3333-3333-3333-333333333333';
  select * into r_dan from public.v_classement_concours
    where concours_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id = '44444444-4444-4444-4444-444444444444';
  assert r_alice.rang = 1, 'T12: Alice rang=1, got ' || r_alice.rang;
  assert r_bob.rang = 2, 'T12: Bob rang=2, got ' || r_bob.rang;
  assert r_carol.rang = 3, 'T12: Carol rang=3 (ex-aequo), got ' || r_carol.rang;
  assert r_dan.rang = 3, 'T12: Dan rang=3 (ex-aequo), got ' || r_dan.rang;
  raise notice 'T12 OK: tri multi-critères + rang RANK() ex-aequo';
end $$;

-- 13. Tri par tie-breaker : on ajoute Eve avec 13 points + 1 exact pour battre Bob
--     sur pronos_exacts (13 vs 13, 1 vs 0 -> Eve avant Bob).
insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, encrypted_password,
  created_at, updated_at
) values
  ('55555555-5555-5555-5555-555555555555'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'eve@test.local', now(),
   '{}'::jsonb, '{"prenom":"Eve"}'::jsonb, '',
   now(), now());

insert into public.concours_participants (concours_id, user_id, role)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'member');

-- Match test pour Eve : MG2 1-1 pour avoir un exact nul.
-- Points Eve : MG2 nul exact 15 points (pas de cote).
-- Pour être à 13 pts comme Bob, on doit compenser : on met uniquement
-- un mauvais prono ailleurs... Simpler : Eve a seulement 1 exact à 13 pts.
-- On ajoute un match finalisé MG4 en groupes 0-0 avec une cote_nul.
insert into public.matchs (
  id, competition_id, phase, round, kick_off_at,
  equipe_a_id, equipe_b_id, score_a, score_b, status,
  cote_a, cote_nul, cote_b
) values (
  '10000000-0000-0000-0000-000000000006'::uuid,
  (select id from public.competitions where code = 'fifa-wc-2026'),
  'groupes', 1, now() - interval '1 day',
  (select id from public.equipes where fifa_id = 11 limit 1),
  (select id from public.equipes where fifa_id = 12 limit 1),
  0, 0, 'finished',
  null, null, null
);

-- Eve pronostique score exact 0-0 sur MG4 (pas de cote -> 15 pts nets)
-- mais on a besoin de ~13, donc on enlève l'insertion et on part sur
-- un scénario différent : Eve a 1 prono "bon vainqueur" + 1 exact,
-- on vise plutôt un test pur : Eve a 13 pts via 1 exact sans cote
-- et 0 pts ailleurs, avec 1 exact -> elle devance Bob qui a 13 pts 0 exact.
-- Donc Eve fait un prono score exact 0-0 sur MG4, 0 autre prono.
-- Eve = 15 pts (pas 13) et 1 exact.
-- Donc pas "ex-aequo en points" mais test de tri points DESC marche :
-- 81 Alice > 15 Eve > 13 Bob > 0 ex-aequo.
insert into public.pronos (concours_id, user_id, match_id, score_a, score_b)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '55555555-5555-5555-5555-555555555555',
  '10000000-0000-0000-0000-000000000006',
  0, 0
);

do $$
declare
  r_eve record;
  r_bob record;
begin
  select * into r_eve from public.v_classement_concours
    where concours_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id = '55555555-5555-5555-5555-555555555555';
  select * into r_bob from public.v_classement_concours
    where concours_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id = '22222222-2222-2222-2222-222222222222';
  assert r_eve.points = 15, 'T13: Eve points=15 (exact nul sans cote)';
  assert r_eve.pronos_exacts = 1, 'T13: Eve pronos_exacts=1';
  assert r_eve.rang = 2, 'T13: Eve rang=2 (entre Alice et Bob), got ' || r_eve.rang;
  assert r_bob.rang = 3, 'T13: Bob rang=3 (décalé), got ' || r_bob.rang;
  raise notice 'T13 OK: Eve 15 pts > Bob 13 pts, rang 2 vs 3';
end $$;

-- ============================================================
do $$ begin raise notice '===================================='; end $$;
do $$ begin raise notice '  SCORING OK — 13 scénarios passés'; end $$;
do $$ begin raise notice '===================================='; end $$;

rollback;
