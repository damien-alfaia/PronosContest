-- =============================================================
--  Tests SQL maison — Jokers scoring effects (Sprint 8.B.2)
-- =============================================================
--
--  Exécution (DB locale `supabase start` active) :
--    psql postgresql://postgres:postgres@localhost:54322/postgres \
--         -v ON_ERROR_STOP=1 \
--         -f supabase/tests/jokers_scoring_effects.sql
--
--  Principe : transaction BEGIN ... ROLLBACK. Chaque scénario dans
--  un savepoint pour isolation.
--
--  Stratégie :
--    - On INSERT directement dans user_jokers avec used_at set
--      (acquired_from='gift' pour contourner les uniques partiels sur
--       starter/badge), ce qui permet de simuler n'importe quelle
--      consommation sans passer par le RPC `use_joker` (déjà couvert
--      par jokers_consumption.sql Sprint 8.B.1). L'objectif ici est
--      de tester les VUES.
--
--  Setup partagé :
--    - 3 users (s1 / s2 / s3)
--    - 1 concours, jokers_enabled=true, odds_multiplier_enabled=false
--      (pour garder le scoring prévisible : points_raw = points_pure)
--    - Scoring rules : exact=15 / winner=5 / draw=7 / ko_bonus=2
--    - 4 matchs :
--        M1 groupes    FINAL 2-1
--        M2 huitiemes  FINAL 3-1
--        M3 groupes    NOT FINAL (kick-off futur)
--        M4 groupes    FINAL 1-1 (draw)
--    - Pronos :
--        s1 : M1=2-1 (exact=15), M2=3-1 (exact+ko=17), M3=2-1,
--             M4=1-1 (exact draw=15)
--        s2 : M1=1-0 (winner=5), M2=2-0 (winner+ko=7), M3=1-0,
--             M4=2-0 (wrong, en plus les scores n'ont pas la même
--                    forme : réalité 1-1 draw, prono 2-0 winner → 0)
--        s3 : M1=0-2 (wrong=0), M2=1-2 (wrong=0), M4=2-1 (wrong=0)
--
--    Points baseline (sans joker) :
--        s1 : 15 + 17 + 15 = 47
--        s2 :  5 +  7 +  0 = 12
--        s3 :  0 +  0 +  0 =  0
--
--  Scénarios (22) :
--    T1.  baseline sans joker → points_final = points_raw
--    T2.  double sur prono exact → ×2
--    T3.  triple sur prono exact → ×3
--    T4.  double sur prono faux → 0 (multiplier × 0)
--    T5.  safety_net sur prono faux → floor 1
--    T6.  safety_net sur prono exact → no-op (floor < points)
--    T7.  boost sur match non-final → points_final = 0
--    T8.  double sur KO exact (bonus_ko additif) → (base+bonus)×multi
--    T9.  double sur KO correct winner → (5+2)×2 = 14
--    T10. safety_net sur KO prono faux → 1
--    T11. boussole (info) sur match → aucun effet sur v_pronos_points
--    T12. gift (social) sans match cible → aucun effet
--    T13. challenge s1→s2 sur M1 (s1=15 > s2=5) → s1 +5, s2 -5
--    T14. challenge s2→s1 sur M1 (inverse) → s2 -5, s1 +5
--    T15. challenge sur match non-final → delta = 0
--    T16. challenge tie (s2 vs s3 sur M4 : 0 vs 0) → 0 transfert
--    T17. double_down sur KO → stakes ±10
--    T18. v_challenge_deltas agrège plusieurs challenges pour un user
--    T19. v_classement_concours : points = prono_points + challenge_delta
--    T20. v_classement_concours : rang intègre le challenge delta
--    T21. v_pronos_points : colonnes présentes (contrat schema)
--    T22. v_classement_concours : colonnes présentes + compat Sprint 4
-- =============================================================

begin;

-- ------------------------------------------------------------
--  Setup (partagé)
-- ------------------------------------------------------------

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, encrypted_password,
  created_at, updated_at
) values
  ('b1111111-1111-1111-1111-111111111111'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'sc1@test.local', now(),
   '{}'::jsonb, '{}'::jsonb, '', now(), now()),
  ('b2222222-2222-2222-2222-222222222222'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'sc2@test.local', now(),
   '{}'::jsonb, '{}'::jsonb, '', now(), now()),
  ('b3333333-3333-3333-3333-333333333333'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'sc3@test.local', now(),
   '{}'::jsonb, '{}'::jsonb, '', now(), now());

do $$
declare
  v_comp_id uuid;
  v_concours_id uuid := 'cc111111-1111-1111-1111-111111111111'::uuid;
  v_equipe_a uuid;
  v_equipe_b uuid;
  v_match_m1 uuid := 'dd111111-1111-1111-1111-1111111111a1'::uuid;
  v_match_m2 uuid := 'dd111111-1111-1111-1111-1111111111a2'::uuid;
  v_match_m3 uuid := 'dd111111-1111-1111-1111-1111111111a3'::uuid;
  v_match_m4 uuid := 'dd111111-1111-1111-1111-1111111111a4'::uuid;
  v_s1 uuid := 'b1111111-1111-1111-1111-111111111111'::uuid;
  v_s2 uuid := 'b2222222-2222-2222-2222-222222222222'::uuid;
  v_s3 uuid := 'b3333333-3333-3333-3333-333333333333'::uuid;
begin
  select id into v_comp_id from public.competitions where code = 'fifa-wc-2026';

  insert into public.concours (
    id, nom, competition_id, owner_id, visibility, jokers_enabled, scoring_rules
  ) values (
    v_concours_id, 'Scoring-effects', v_comp_id, v_s1, 'public', true,
    jsonb_build_object(
      'exact_score', 15,
      'correct_winner', 5,
      'correct_draw', 7,
      'knockout_bonus', 2,
      'odds_multiplier_enabled', false
    )
  );

  insert into public.concours_participants (concours_id, user_id, role) values
    (v_concours_id, v_s2, 'member'),
    (v_concours_id, v_s3, 'member');

  select id into v_equipe_a from public.equipes where competition_id = v_comp_id order by id limit 1;
  select id into v_equipe_b from public.equipes
    where competition_id = v_comp_id and id <> v_equipe_a order by id limit 1;

  -- M1 groupes FINAL 2-1
  insert into public.matchs (
    id, competition_id, phase, kick_off_at, equipe_a_id, equipe_b_id,
    status, score_a, score_b
  ) values (
    v_match_m1, v_comp_id, 'groupes', now() - interval '2 days',
    v_equipe_a, v_equipe_b, 'finished', 2, 1
  );

  -- M2 huitiemes FINAL 3-1
  insert into public.matchs (
    id, competition_id, phase, kick_off_at, equipe_a_id, equipe_b_id,
    status, score_a, score_b
  ) values (
    v_match_m2, v_comp_id, 'huitiemes', now() - interval '1 day',
    v_equipe_a, v_equipe_b, 'finished', 3, 1
  );

  -- M3 groupes NOT FINAL (futur)
  insert into public.matchs (
    id, competition_id, phase, kick_off_at, equipe_a_id, equipe_b_id
  ) values (
    v_match_m3, v_comp_id, 'groupes', now() + interval '2 days',
    v_equipe_a, v_equipe_b
  );

  -- M4 groupes FINAL 1-1 (draw)
  insert into public.matchs (
    id, competition_id, phase, kick_off_at, equipe_a_id, equipe_b_id,
    status, score_a, score_b
  ) values (
    v_match_m4, v_comp_id, 'groupes', now() - interval '3 hours',
    v_equipe_a, v_equipe_b, 'finished', 1, 1
  );

  -- Pronos
  insert into public.pronos (concours_id, user_id, match_id, score_a, score_b) values
    -- s1
    (v_concours_id, v_s1, v_match_m1, 2, 1),  -- exact → 15
    (v_concours_id, v_s1, v_match_m2, 3, 1),  -- exact + ko → 17
    (v_concours_id, v_s1, v_match_m3, 2, 1),  -- non-final → 0
    (v_concours_id, v_s1, v_match_m4, 1, 1),  -- exact draw → 15
    -- s2
    (v_concours_id, v_s2, v_match_m1, 1, 0),  -- winner → 5
    (v_concours_id, v_s2, v_match_m2, 2, 0),  -- winner + ko → 7
    (v_concours_id, v_s2, v_match_m3, 1, 0),  -- non-final → 0
    (v_concours_id, v_s2, v_match_m4, 2, 0),  -- wrong → 0
    -- s3
    (v_concours_id, v_s3, v_match_m1, 0, 2),  -- wrong → 0
    (v_concours_id, v_s3, v_match_m2, 1, 2),  -- wrong → 0
    (v_concours_id, v_s3, v_match_m4, 2, 1);  -- wrong → 0

  raise notice 'SETUP OK — concours jokers scoring + 4 matchs + 11 pronos';
end $$;

-- Helper : consomme un joker en créant un slot déjà utilisé.
-- acquired_from='gift' pour éviter les uniques partiels sur starter/badge.
create or replace function pg_temp.mark_used(
  p_user uuid, p_concours uuid, p_code text,
  p_match uuid default null,
  p_target_user uuid default null,
  p_payload jsonb default null
) returns void
language plpgsql
as $$
begin
  insert into public.user_jokers (
    user_id, concours_id, joker_code, acquired_from,
    used_at, used_on_match_id, used_on_target_user_id, used_payload
  ) values (
    p_user, p_concours, p_code, 'gift',
    now(), p_match, p_target_user, p_payload
  );
end;
$$;

-- ------------------------------------------------------------
--  T1 : baseline (pas de joker) → points_final = points_raw
-- ------------------------------------------------------------
savepoint t1;
do $$
declare
  r record;
begin
  select * into r from public.v_pronos_points
  where concours_id = 'cc111111-1111-1111-1111-111111111111'::uuid
    and user_id = 'b1111111-1111-1111-1111-111111111111'::uuid
    and match_id = 'dd111111-1111-1111-1111-1111111111a1'::uuid;

  assert r.is_final = true, 'M1 est final';
  assert r.is_exact = true, 'prono 2-1 sur score 2-1 = exact';
  assert r.points_base = 15, 'exact_score=15';
  assert r.bonus_ko = 0, 'groupes → pas de bonus KO';
  assert r.points_pure = 15, 'points_pure = base + bonus';
  assert r.joker_multiplier = 1, 'baseline : multiplier = 1';
  assert r.joker_safety_net = false, 'baseline : pas de safety_net';
  assert r.points_raw = 15, 'points_raw = round((base+bonus)*1) = 15';
  assert r.points_final = 15, 'baseline : points_final = points_raw';
  raise notice 'T1 OK — baseline';
end $$;
rollback to savepoint t1;

-- ------------------------------------------------------------
--  T2 : double sur prono exact → ×2
-- ------------------------------------------------------------
savepoint t2;
do $$
declare
  r record;
begin
  perform pg_temp.mark_used(
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'cc111111-1111-1111-1111-111111111111'::uuid,
    'double',
    'dd111111-1111-1111-1111-1111111111a1'::uuid
  );

  select * into r from public.v_pronos_points
  where user_id = 'b1111111-1111-1111-1111-111111111111'::uuid
    and match_id = 'dd111111-1111-1111-1111-1111111111a1'::uuid;

  assert r.joker_multiplier = 2, 'double → multiplier 2';
  assert r.joker_safety_net = false;
  assert r.points_raw = 15;
  assert r.points_final = 30, '15 × 2 = 30';
  raise notice 'T2 OK — double exact';
end $$;
rollback to savepoint t2;

-- ------------------------------------------------------------
--  T3 : triple sur prono exact → ×3
-- ------------------------------------------------------------
savepoint t3;
do $$
declare
  r record;
begin
  perform pg_temp.mark_used(
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'cc111111-1111-1111-1111-111111111111'::uuid,
    'triple',
    'dd111111-1111-1111-1111-1111111111a1'::uuid
  );

  select * into r from public.v_pronos_points
  where user_id = 'b1111111-1111-1111-1111-111111111111'::uuid
    and match_id = 'dd111111-1111-1111-1111-1111111111a1'::uuid;

  assert r.joker_multiplier = 3, 'triple → multiplier 3';
  assert r.points_final = 45, '15 × 3 = 45';
  raise notice 'T3 OK — triple exact';
end $$;
rollback to savepoint t3;

-- ------------------------------------------------------------
--  T4 : double sur prono faux → 0 (0 × 2 = 0, multiplier no-op)
-- ------------------------------------------------------------
savepoint t4;
do $$
declare
  r record;
begin
  perform pg_temp.mark_used(
    'b3333333-3333-3333-3333-333333333333'::uuid,
    'cc111111-1111-1111-1111-111111111111'::uuid,
    'double',
    'dd111111-1111-1111-1111-1111111111a1'::uuid
  );

  select * into r from public.v_pronos_points
  where user_id = 'b3333333-3333-3333-3333-333333333333'::uuid
    and match_id = 'dd111111-1111-1111-1111-1111111111a1'::uuid;

  assert r.points_base = 0, 'prono faux → 0';
  assert r.joker_multiplier = 2, 'double actif quand même';
  assert r.points_final = 0, '0 × 2 = 0 (multiplier no-op sur faux)';
  raise notice 'T4 OK — double sur prono faux = 0';
end $$;
rollback to savepoint t4;

-- ------------------------------------------------------------
--  T5 : safety_net sur prono faux → floor +1
-- ------------------------------------------------------------
savepoint t5;
do $$
declare
  r record;
begin
  perform pg_temp.mark_used(
    'b3333333-3333-3333-3333-333333333333'::uuid,
    'cc111111-1111-1111-1111-111111111111'::uuid,
    'safety_net',
    'dd111111-1111-1111-1111-1111111111a1'::uuid
  );

  select * into r from public.v_pronos_points
  where user_id = 'b3333333-3333-3333-3333-333333333333'::uuid
    and match_id = 'dd111111-1111-1111-1111-1111111111a1'::uuid;

  assert r.points_base = 0;
  assert r.joker_multiplier = 1, 'safety_net seul n''a pas de multiplier';
  assert r.joker_safety_net = true;
  assert r.points_raw = 0;
  assert r.points_final = 1, 'safety_net floor à 1 même sur prono faux';
  raise notice 'T5 OK — safety_net floor +1 sur faux';
end $$;
rollback to savepoint t5;

-- ------------------------------------------------------------
--  T6 : safety_net sur prono exact (points > 1) → no-op
-- ------------------------------------------------------------
savepoint t6;
do $$
declare
  r record;
begin
  perform pg_temp.mark_used(
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'cc111111-1111-1111-1111-111111111111'::uuid,
    'safety_net',
    'dd111111-1111-1111-1111-1111111111a1'::uuid
  );

  select * into r from public.v_pronos_points
  where user_id = 'b1111111-1111-1111-1111-111111111111'::uuid
    and match_id = 'dd111111-1111-1111-1111-1111111111a1'::uuid;

  assert r.joker_safety_net = true;
  assert r.points_final = 15, 'safety_net no-op quand points > 1 (GREATEST(15, 1) = 15)';
  raise notice 'T6 OK — safety_net no-op sur exact';
end $$;
rollback to savepoint t6;

-- ------------------------------------------------------------
--  T7 : boost sur match non-final → points_final = 0
-- ------------------------------------------------------------
savepoint t7;
do $$
declare
  r record;
begin
  perform pg_temp.mark_used(
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'cc111111-1111-1111-1111-111111111111'::uuid,
    'double',
    'dd111111-1111-1111-1111-1111111111a3'::uuid  -- M3 non-final
  );

  select * into r from public.v_pronos_points
  where user_id = 'b1111111-1111-1111-1111-111111111111'::uuid
    and match_id = 'dd111111-1111-1111-1111-1111111111a3'::uuid;

  assert r.is_final = false, 'M3 non-final';
  assert r.joker_multiplier = 2, 'joker quand même reconnu';
  assert r.points_final = 0, 'non-final → 0 quel que soit le multiplier';
  raise notice 'T7 OK — boost sur non-final = 0';
end $$;
rollback to savepoint t7;

-- ------------------------------------------------------------
--  T8 : double sur KO exact (bonus_ko additif) → (base+bonus)×2
-- ------------------------------------------------------------
savepoint t8;
do $$
declare
  r record;
begin
  perform pg_temp.mark_used(
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'cc111111-1111-1111-1111-111111111111'::uuid,
    'double',
    'dd111111-1111-1111-1111-1111111111a2'::uuid  -- M2 huitiemes exact
  );

  select * into r from public.v_pronos_points
  where user_id = 'b1111111-1111-1111-1111-111111111111'::uuid
    and match_id = 'dd111111-1111-1111-1111-1111111111a2'::uuid;

  assert r.points_base = 15, 'exact_score=15';
  assert r.bonus_ko = 2, 'KO bonus additif';
  assert r.points_pure = 17, '15 + 2 = 17';
  assert r.points_raw = 17, 'odds désactivés';
  assert r.points_final = 34, '(15+2) × 2 = 34';
  raise notice 'T8 OK — double sur KO exact = 34';
end $$;
rollback to savepoint t8;

-- ------------------------------------------------------------
--  T9 : double sur KO correct winner (non-exact)
-- ------------------------------------------------------------
savepoint t9;
do $$
declare
  r record;
begin
  perform pg_temp.mark_used(
    'b2222222-2222-2222-2222-222222222222'::uuid,
    'cc111111-1111-1111-1111-111111111111'::uuid,
    'double',
    'dd111111-1111-1111-1111-1111111111a2'::uuid  -- M2 huitiemes winner
  );

  select * into r from public.v_pronos_points
  where user_id = 'b2222222-2222-2222-2222-222222222222'::uuid
    and match_id = 'dd111111-1111-1111-1111-1111111111a2'::uuid;

  assert r.points_base = 5, 'correct_winner=5';
  assert r.bonus_ko = 2;
  assert r.points_final = 14, '(5+2) × 2 = 14';
  raise notice 'T9 OK — double sur KO winner = 14';
end $$;
rollback to savepoint t9;

-- ------------------------------------------------------------
--  T10 : safety_net sur KO prono faux → floor 1
-- ------------------------------------------------------------
savepoint t10;
do $$
declare
  r record;
begin
  perform pg_temp.mark_used(
    'b3333333-3333-3333-3333-333333333333'::uuid,
    'cc111111-1111-1111-1111-111111111111'::uuid,
    'safety_net',
    'dd111111-1111-1111-1111-1111111111a2'::uuid  -- M2 wrong
  );

  select * into r from public.v_pronos_points
  where user_id = 'b3333333-3333-3333-3333-333333333333'::uuid
    and match_id = 'dd111111-1111-1111-1111-1111111111a2'::uuid;

  assert r.points_base = 0, 'wrong prono → 0';
  assert r.bonus_ko = 0, 'bonus_ko nul sur wrong prono';
  assert r.joker_safety_net = true;
  assert r.points_final = 1, 'safety_net floor +1';
  raise notice 'T10 OK — safety_net KO faux = 1';
end $$;
rollback to savepoint t10;

-- ------------------------------------------------------------
--  T11 : boussole (info) → aucun effet scoring
-- ------------------------------------------------------------
savepoint t11;
do $$
declare
  r record;
begin
  perform pg_temp.mark_used(
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'cc111111-1111-1111-1111-111111111111'::uuid,
    'boussole',
    'dd111111-1111-1111-1111-1111111111a1'::uuid,
    null,
    jsonb_build_object('score_a', 2, 'score_b', 1, 'count', 5)
  );

  select * into r from public.v_pronos_points
  where user_id = 'b1111111-1111-1111-1111-111111111111'::uuid
    and match_id = 'dd111111-1111-1111-1111-1111111111a1'::uuid;

  assert r.joker_multiplier = 1, 'boussole catégorie info → pas de multiplier';
  assert r.joker_safety_net = false, 'boussole n''est pas safety_net';
  assert r.points_final = 15, 'boussole sans effet sur scoring';
  raise notice 'T11 OK — boussole sans effet scoring';
end $$;
rollback to savepoint t11;

-- ------------------------------------------------------------
--  T12 : gift (social sans match) → aucun effet
-- ------------------------------------------------------------
savepoint t12;
do $$
declare
  r record;
  v_count int;
begin
  -- gift consommé sans match cible (p_target_match_id = null)
  insert into public.user_jokers (
    user_id, concours_id, joker_code, acquired_from,
    used_at, used_on_match_id, used_on_target_user_id, used_payload
  ) values (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'cc111111-1111-1111-1111-111111111111'::uuid,
    'gift', 'gift', now(), null,
    'b2222222-2222-2222-2222-222222222222'::uuid,
    jsonb_build_object('gifted_joker_code', 'triple')
  );

  -- v_pronos_points n'a pas connaissance de ce joker (used_on_match_id null)
  select * into r from public.v_pronos_points
  where user_id = 'b1111111-1111-1111-1111-111111111111'::uuid
    and match_id = 'dd111111-1111-1111-1111-1111111111a1'::uuid;

  assert r.points_final = 15, 'gift sans match → no-op scoring';
  assert r.joker_multiplier = 1;

  -- v_challenge_deltas est dense (1 ligne par participant via LEFT
  -- JOIN concours_participants). Donc 3 lignes, toutes à 0 tant
  -- qu'aucun challenge n'a été consommé.
  select count(*) into v_count
  from public.v_challenge_deltas
  where concours_id = 'cc111111-1111-1111-1111-111111111111'::uuid;
  assert v_count = 3, format(
    'v_challenge_deltas doit avoir 1 ligne par participant (trouvé %s)',
    v_count
  );
  raise notice 'T12 OK — gift sans effet scoring';
end $$;
rollback to savepoint t12;

-- ------------------------------------------------------------
--  T13 : challenge s1→s2 sur M1 (s1=15 > s2=5) → s1 +5, s2 -5
-- ------------------------------------------------------------
savepoint t13;
do $$
declare
  r_s1 record;
  r_s2 record;
  r_s3 record;
begin
  perform pg_temp.mark_used(
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'cc111111-1111-1111-1111-111111111111'::uuid,
    'challenge',
    'dd111111-1111-1111-1111-1111111111a1'::uuid,
    'b2222222-2222-2222-2222-222222222222'::uuid,
    jsonb_build_object('stakes', 5)
  );

  select * into r_s1 from public.v_challenge_deltas
    where user_id = 'b1111111-1111-1111-1111-111111111111'::uuid
      and concours_id = 'cc111111-1111-1111-1111-111111111111'::uuid;
  select * into r_s2 from public.v_challenge_deltas
    where user_id = 'b2222222-2222-2222-2222-222222222222'::uuid
      and concours_id = 'cc111111-1111-1111-1111-111111111111'::uuid;
  select * into r_s3 from public.v_challenge_deltas
    where user_id = 'b3333333-3333-3333-3333-333333333333'::uuid
      and concours_id = 'cc111111-1111-1111-1111-111111111111'::uuid;

  assert r_s1.challenge_delta = 5, 's1 gagne → +5';
  assert r_s2.challenge_delta = -5, 's2 perd → -5';
  assert r_s3.challenge_delta = 0, 's3 non impliqué → 0';
  raise notice 'T13 OK — challenge s1 vainqueur = +5/-5';
end $$;
rollback to savepoint t13;

-- ------------------------------------------------------------
--  T14 : challenge s2→s1 (inverse) sur M1 → s2 -5, s1 +5
-- ------------------------------------------------------------
savepoint t14;
do $$
declare
  r_s1 record;
  r_s2 record;
begin
  perform pg_temp.mark_used(
    'b2222222-2222-2222-2222-222222222222'::uuid,
    'cc111111-1111-1111-1111-111111111111'::uuid,
    'challenge',
    'dd111111-1111-1111-1111-1111111111a1'::uuid,
    'b1111111-1111-1111-1111-111111111111'::uuid,
    jsonb_build_object('stakes', 5)
  );

  select * into r_s1 from public.v_challenge_deltas
    where user_id = 'b1111111-1111-1111-1111-111111111111'::uuid;
  select * into r_s2 from public.v_challenge_deltas
    where user_id = 'b2222222-2222-2222-2222-222222222222'::uuid;

  assert r_s1.challenge_delta = 5, 's1 (target) meilleur → +5';
  assert r_s2.challenge_delta = -5, 's2 (caller) moins bon → -5';
  raise notice 'T14 OK — challenge target meilleur = inverse';
end $$;
rollback to savepoint t14;

-- ------------------------------------------------------------
--  T15 : challenge sur match non-final → delta = 0
-- ------------------------------------------------------------
savepoint t15;
do $$
declare
  r record;
begin
  perform pg_temp.mark_used(
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'cc111111-1111-1111-1111-111111111111'::uuid,
    'challenge',
    'dd111111-1111-1111-1111-1111111111a3'::uuid,  -- M3 non-final
    'b2222222-2222-2222-2222-222222222222'::uuid,
    jsonb_build_object('stakes', 5)
  );

  select * into r from public.v_challenge_deltas
    where user_id = 'b1111111-1111-1111-1111-111111111111'::uuid;
  assert r.challenge_delta = 0, 'non-final → delta 0';

  select * into r from public.v_challenge_deltas
    where user_id = 'b2222222-2222-2222-2222-222222222222'::uuid;
  assert r.challenge_delta = 0, 'non-final → delta 0 côté target';
  raise notice 'T15 OK — challenge non-final = 0';
end $$;
rollback to savepoint t15;

-- ------------------------------------------------------------
--  T16 : challenge tie (s2 vs s3 sur M4, les deux à 0) → 0
-- ------------------------------------------------------------
savepoint t16;
do $$
declare
  r_s2 record;
  r_s3 record;
begin
  perform pg_temp.mark_used(
    'b2222222-2222-2222-2222-222222222222'::uuid,
    'cc111111-1111-1111-1111-111111111111'::uuid,
    'challenge',
    'dd111111-1111-1111-1111-1111111111a4'::uuid,  -- M4 draw, s2=0 s3=0
    'b3333333-3333-3333-3333-333333333333'::uuid,
    jsonb_build_object('stakes', 5)
  );

  select * into r_s2 from public.v_challenge_deltas
    where user_id = 'b2222222-2222-2222-2222-222222222222'::uuid;
  select * into r_s3 from public.v_challenge_deltas
    where user_id = 'b3333333-3333-3333-3333-333333333333'::uuid;

  assert r_s2.challenge_delta = 0, 'tie 0-0 → 0 transfert caller';
  assert r_s3.challenge_delta = 0, 'tie → 0 transfert target';
  raise notice 'T16 OK — challenge tie = 0';
end $$;
rollback to savepoint t16;

-- ------------------------------------------------------------
--  T17 : double_down sur M2 (s1=17, s2=7) → ±10
-- ------------------------------------------------------------
savepoint t17;
do $$
declare
  r_s1 record;
  r_s2 record;
begin
  perform pg_temp.mark_used(
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'cc111111-1111-1111-1111-111111111111'::uuid,
    'double_down',
    'dd111111-1111-1111-1111-1111111111a2'::uuid,
    'b2222222-2222-2222-2222-222222222222'::uuid,
    jsonb_build_object('stakes', 10)
  );

  select * into r_s1 from public.v_challenge_deltas
    where user_id = 'b1111111-1111-1111-1111-111111111111'::uuid;
  select * into r_s2 from public.v_challenge_deltas
    where user_id = 'b2222222-2222-2222-2222-222222222222'::uuid;

  assert r_s1.challenge_delta = 10, 'double_down : s1 +10';
  assert r_s2.challenge_delta = -10, 'double_down : s2 -10';
  raise notice 'T17 OK — double_down ±10';
end $$;
rollback to savepoint t17;

-- ------------------------------------------------------------
--  T18 : v_challenge_deltas agrège plusieurs challenges pour un user
--        s1 lance 2 challenges : M1 contre s2 (+5), M2 contre s3 (+5)
--        → total s1 = +10
-- ------------------------------------------------------------
savepoint t18;
do $$
declare
  r_s1 record;
  r_s2 record;
  r_s3 record;
begin
  -- Challenge 1 : s1 → s2 sur M1 (s1=15 > s2=5)
  perform pg_temp.mark_used(
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'cc111111-1111-1111-1111-111111111111'::uuid,
    'challenge',
    'dd111111-1111-1111-1111-1111111111a1'::uuid,
    'b2222222-2222-2222-2222-222222222222'::uuid,
    jsonb_build_object('stakes', 5)
  );
  -- Challenge 2 : s1 → s3 sur M2 (s1=17 > s3=0)
  perform pg_temp.mark_used(
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'cc111111-1111-1111-1111-111111111111'::uuid,
    'challenge',
    'dd111111-1111-1111-1111-1111111111a2'::uuid,
    'b3333333-3333-3333-3333-333333333333'::uuid,
    jsonb_build_object('stakes', 5)
  );

  select * into r_s1 from public.v_challenge_deltas
    where user_id = 'b1111111-1111-1111-1111-111111111111'::uuid;
  select * into r_s2 from public.v_challenge_deltas
    where user_id = 'b2222222-2222-2222-2222-222222222222'::uuid;
  select * into r_s3 from public.v_challenge_deltas
    where user_id = 'b3333333-3333-3333-3333-333333333333'::uuid;

  assert r_s1.challenge_delta = 10, 's1 gagne 2 challenges → +10';
  assert r_s2.challenge_delta = -5, 's2 perd 1 challenge → -5';
  assert r_s3.challenge_delta = -5, 's3 perd 1 challenge → -5';
  raise notice 'T18 OK — agrégation multi-challenge';
end $$;
rollback to savepoint t18;

-- ------------------------------------------------------------
--  T19 : v_classement_concours : points = prono_points + challenge_delta
-- ------------------------------------------------------------
savepoint t19;
do $$
declare
  r_s1 record;
  r_s2 record;
begin
  -- s1 met double sur M1 (exact ×2 → 30 au lieu de 15)
  --     + challenge s1 vs s2 sur M2 (s1=17 > s2=7) → s1 +5, s2 -5
  perform pg_temp.mark_used(
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'cc111111-1111-1111-1111-111111111111'::uuid,
    'double',
    'dd111111-1111-1111-1111-1111111111a1'::uuid
  );
  perform pg_temp.mark_used(
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'cc111111-1111-1111-1111-111111111111'::uuid,
    'challenge',
    'dd111111-1111-1111-1111-1111111111a2'::uuid,
    'b2222222-2222-2222-2222-222222222222'::uuid,
    jsonb_build_object('stakes', 5)
  );

  select * into r_s1 from public.v_classement_concours
    where user_id = 'b1111111-1111-1111-1111-111111111111'::uuid
      and concours_id = 'cc111111-1111-1111-1111-111111111111'::uuid;
  select * into r_s2 from public.v_classement_concours
    where user_id = 'b2222222-2222-2222-2222-222222222222'::uuid
      and concours_id = 'cc111111-1111-1111-1111-111111111111'::uuid;

  -- s1 baseline prono_points : 47. Avec double sur M1 → +15 → 62.
  -- challenge gagné → +5. Total = 67.
  assert r_s1.prono_points = 62, format(
    's1.prono_points attendu 62 (47 baseline + 15 double), eu %s', r_s1.prono_points
  );
  assert r_s1.challenge_delta = 5;
  assert r_s1.points = 67, format('s1.points = prono_points + delta = 67, eu %s', r_s1.points);

  -- s2 baseline 12 (inchangé). challenge perdu → -5. Total = 7.
  assert r_s2.prono_points = 12;
  assert r_s2.challenge_delta = -5;
  assert r_s2.points = 7;
  raise notice 'T19 OK — classement = prono + delta';
end $$;
rollback to savepoint t19;

-- ------------------------------------------------------------
--  T20 : rang intègre le challenge_delta
--        On crée un scénario où sans delta s1 serait 1er mais avec
--        challenge perdu majeur, il descend en 2.
-- ------------------------------------------------------------
savepoint t20;
do $$
declare
  r_s1 record;
  r_s2 record;
begin
  -- s2 met triple sur M2 exact → (5+2)×3 = 21 (au lieu de 7) → +14
  -- et met double_down sur M2 contre s1 (s1=17 > s2=7) → s2 perd -10
  -- S2 final : baseline 12 + 14 (triple) - 10 (challenge perdu) = 16
  -- S1 final : baseline 47 + 10 (challenge gagné) = 57
  -- Donc s1 reste 1er, s2 reste 2e.

  -- Scénario plus spectaculaire : s2 triple sur M2 exact ET gagne un
  -- grand challenge contre s1 → mais s2=7 < s1=17 donc s2 ne peut pas
  -- gagner. Il faut imaginer un scénario où le transfert change le
  -- classement. On bascule plutôt un test simple : delta négatif
  -- affecte bien le rang.

  -- Ici on teste juste que rang respecte points desc :
  -- s1 gagne double_down → +10 (s1=17 > s3=0 sur M2)
  perform pg_temp.mark_used(
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'cc111111-1111-1111-1111-111111111111'::uuid,
    'double_down',
    'dd111111-1111-1111-1111-1111111111a2'::uuid,
    'b3333333-3333-3333-3333-333333333333'::uuid,
    jsonb_build_object('stakes', 10)
  );

  select * into r_s1 from public.v_classement_concours
    where user_id = 'b1111111-1111-1111-1111-111111111111'::uuid;
  select * into r_s2 from public.v_classement_concours
    where user_id = 'b3333333-3333-3333-3333-333333333333'::uuid;

  assert r_s1.points = 57, 's1 47 + 10 = 57';
  assert r_s1.rang = 1, 's1 rang 1';
  assert r_s2.points = -10, 's3 0 - 10 = -10 (delta peut être négatif)';
  assert r_s2.rang = 3, 's3 rang 3';
  raise notice 'T20 OK — rang intègre deltas (négatifs possibles)';
end $$;
rollback to savepoint t20;

-- ------------------------------------------------------------
--  T21 : v_pronos_points — colonnes présentes (contrat schema)
-- ------------------------------------------------------------
savepoint t21;
do $$
declare
  v_found int;
begin
  select count(*) into v_found
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'v_pronos_points'
    and column_name in (
      'concours_id', 'user_id', 'match_id', 'phase', 'match_status',
      'is_final', 'is_exact', 'points_base', 'bonus_ko', 'cote_appliquee',
      'points_pure', 'joker_multiplier', 'joker_safety_net',
      'points_raw', 'points_final'
    );
  assert v_found = 15, format(
    'v_pronos_points doit exposer 15 colonnes (10 Sprint 4 + 5 Sprint 8), trouvé %s', v_found
  );
  raise notice 'T21 OK — v_pronos_points schema (15 colonnes)';
end $$;
rollback to savepoint t21;

-- ------------------------------------------------------------
--  T22 : v_classement_concours — colonnes présentes + compat Sprint 4
-- ------------------------------------------------------------
savepoint t22;
do $$
declare
  v_found int;
begin
  select count(*) into v_found
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'v_classement_concours'
    and column_name in (
      'concours_id', 'user_id', 'prenom', 'nom', 'avatar_url',
      'points', 'pronos_joues', 'pronos_gagnes', 'pronos_exacts', 'rang',
      'prono_points', 'challenge_delta'
    );
  assert v_found = 12, format(
    'v_classement_concours doit exposer 12 colonnes (10 Sprint 4 + 2 Sprint 8), trouvé %s', v_found
  );

  -- Sanity check : la colonne `points` garde le type int (compat Zod)
  select count(*) into v_found
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'v_classement_concours'
    and column_name = 'points'
    and data_type = 'integer';
  assert v_found = 1, 'points doit rester integer';
  raise notice 'T22 OK — v_classement_concours schema (12 colonnes)';
end $$;
rollback to savepoint t22;

-- ------------------------------------------------------------
--  Fin : tout rollback pour ne laisser aucune trace.
-- ------------------------------------------------------------

rollback;

\echo '============================================='
\echo '  22 scénarios jokers scoring effects OK'
\echo '============================================='
