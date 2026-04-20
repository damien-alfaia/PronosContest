-- =============================================================
--  Sprint 4 — Scoring & classement Realtime
-- =============================================================
--
--  Ajouts :
--    1. Colonnes cote_a / cote_nul / cote_b sur `matchs` (nullable).
--       NULL = pas de cote -> multiplier no-op même si activé.
--       Contrainte : cote >= 1.00 quand définie (cote fair 1.00 = certitude).
--
--    2. Policy supplémentaire sur `profiles` :
--       un participant peut voir prenom / nom / avatar des autres
--       membres du même concours (indispensable pour le classement).
--       La policy initiale "profiles_select_own" reste intacte :
--       les deux sont ORées par Postgres -> effet union.
--
--    3. Vue `v_pronos_points` : pour chaque prono d'un match finalisé,
--       calcule points_base, bonus_ko et cote_appliquee selon les
--       `scoring_rules` du concours. Hérite de la RLS de pronos via
--       security_invoker=on. Conséquence : un user ne voit pas les
--       pronos non-lockés des autres, mais comme seuls les matchs
--       FINISHED produisent des points et qu'un match FINISHED est
--       forcément locked, le classement reste complet et correct.
--
--    4. Vue `v_classement_concours` : agrège v_pronos_points par
--       (concours_id, user_id) en partant de `concours_participants`
--       pour inclure les users 0-prono. Join profiles pour pseudo +
--       avatar. Tri par RANK() :
--         points DESC -> pronos_exacts DESC -> pronos_gagnes DESC.
--
--    5. Realtime : ajout de `matchs` et `pronos` à la publication
--       `supabase_realtime` pour que le front invalide ses queries
--       TanStack au vol (UPDATE score / saisie prono).
--
--  Notes :
--    - Sémantique scoring validée avec l'utilisateur :
--        exact_score > correct_draw > correct_winner > 0,
--        knockout_bonus ADDITIF si points_base > 0 ET phase <> 'groupes',
--        multiplier = cote du résultat PRONOSTIQUÉ (pas le réel) si
--        odds_multiplier_enabled ET cote non NULL,
--        points_final = round((points_base + bonus_ko) * cote).
--    - Le prono sur match non finalisé (score NULL / status != 'finished')
--      est ignoré (0 point, non compté dans pronos_joues).
--    - vainqueur_tab non scoré en MVP (utile plus tard pour les TAB).
--
-- =============================================================

-- ---------- 1. Ajout cotes sur matchs ----------
alter table public.matchs
  add column cote_a numeric(5, 2) check (cote_a is null or cote_a >= 1.00),
  add column cote_nul numeric(5, 2) check (cote_nul is null or cote_nul >= 1.00),
  add column cote_b numeric(5, 2) check (cote_b is null or cote_b >= 1.00);

comment on column public.matchs.cote_a is
  'Cote betting sur victoire équipe A (>=1.00). NULL = inconnue.';
comment on column public.matchs.cote_nul is
  'Cote betting sur nul (>=1.00). NULL en phase KO (nul impossible).';
comment on column public.matchs.cote_b is
  'Cote betting sur victoire équipe B (>=1.00). NULL = inconnue.';

-- ---------- 2. Policy profiles : voir les membres du même concours ----------
-- La sous-requête passe par la RLS de cp, qui appelle is_participant()
-- en SECURITY DEFINER : pas de risque de récursion infinie.
create policy "profiles_select_same_concours"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.concours_participants cp1
      inner join public.concours_participants cp2
        on cp1.concours_id = cp2.concours_id
      where cp1.user_id = auth.uid()
        and cp2.user_id = profiles.id
    )
  );

comment on policy "profiles_select_same_concours" on public.profiles is
  'Autorise la lecture des profils des autres membres d''un concours partagé (pour afficher le classement).';

-- ---------- 3. Vue v_pronos_points ----------
-- Une ligne par prono saisi. Les colonnes is_final / is_exact / is_won
-- sont à FALSE tant que le match n'est pas FINISHED avec un score, et
-- points_base / bonus_ko / cote_appliquee valent 0 ou NULL dans ce cas.
create or replace view public.v_pronos_points
with (security_invoker = on) as
with base as (
  select
    p.concours_id,
    p.user_id,
    p.match_id,
    m.phase,
    m.status as match_status,
    c.scoring_rules,
    p.score_a as p_a,
    p.score_b as p_b,
    m.score_a as m_a,
    m.score_b as m_b,
    m.cote_a,
    m.cote_nul,
    m.cote_b,
    (
      m.status = 'finished'
      and m.score_a is not null
      and m.score_b is not null
    ) as is_final
  from public.pronos p
  inner join public.matchs m on m.id = p.match_id
  inner join public.concours c on c.id = p.concours_id
)
select
  concours_id,
  user_id,
  match_id,
  phase,
  match_status,
  is_final,
  (is_final and p_a = m_a and p_b = m_b) as is_exact,
  case
    when not is_final then 0
    when p_a = m_a and p_b = m_b then (scoring_rules ->> 'exact_score')::int
    when p_a = p_b and m_a = m_b then (scoring_rules ->> 'correct_draw')::int
    when sign(p_a - p_b) = sign(m_a - m_b) then (scoring_rules ->> 'correct_winner')::int
    else 0
  end as points_base,
  case
    when is_final
      and phase <> 'groupes'
      and (
        (p_a = m_a and p_b = m_b)
        or (p_a = p_b and m_a = m_b)
        or (sign(p_a - p_b) = sign(m_a - m_b))
      )
    then coalesce((scoring_rules ->> 'knockout_bonus')::int, 0)
    else 0
  end as bonus_ko,
  case
    when is_final
      and coalesce((scoring_rules ->> 'odds_multiplier_enabled')::boolean, false) = true
      and (
        (p_a = m_a and p_b = m_b)
        or (p_a = p_b and m_a = m_b)
        or (sign(p_a - p_b) = sign(m_a - m_b))
      )
    then
      case
        when p_a > p_b then cote_a
        when p_b > p_a then cote_b
        else cote_nul
      end
    else null
  end as cote_appliquee
from base;

comment on view public.v_pronos_points is
  'Points calculés par prono. security_invoker=on pour hériter de la RLS de pronos.';

grant select on public.v_pronos_points to authenticated;

-- ---------- 4. Vue v_classement_concours ----------
-- Part de concours_participants pour inclure les users 0-prono (LEFT JOIN).
-- La RANK() gère les ex-aequo (tous à la même place, saut au rang suivant).
create or replace view public.v_classement_concours
with (security_invoker = on) as
with per_user as (
  select
    cp.concours_id,
    cp.user_id,
    coalesce(
      sum(
        round(
          (pp.points_base + pp.bonus_ko)
          * coalesce(pp.cote_appliquee, 1.0)
        )
      ),
      0
    )::int as points,
    count(pp.match_id) filter (where pp.is_final) as pronos_joues,
    count(pp.match_id) filter (where pp.is_final and pp.points_base > 0) as pronos_gagnes,
    count(pp.match_id) filter (where pp.is_final and pp.is_exact) as pronos_exacts
  from public.concours_participants cp
  left join public.v_pronos_points pp
    on pp.concours_id = cp.concours_id
    and pp.user_id = cp.user_id
  group by cp.concours_id, cp.user_id
)
select
  pu.concours_id,
  pu.user_id,
  pr.prenom,
  pr.nom,
  pr.avatar_url,
  pu.points,
  pu.pronos_joues,
  pu.pronos_gagnes,
  pu.pronos_exacts,
  rank() over (
    partition by pu.concours_id
    order by
      pu.points desc,
      pu.pronos_exacts desc,
      pu.pronos_gagnes desc
  ) as rang
from per_user pu
left join public.profiles pr on pr.id = pu.user_id;

comment on view public.v_classement_concours is
  'Classement agrégé par concours, trié par points / pronos_exacts / pronos_gagnes. security_invoker=on.';

grant select on public.v_classement_concours to authenticated;

-- ---------- 5. Realtime ----------
-- Ajout des tables scorables à la publication Supabase Realtime pour
-- que le front invalide ses queries TanStack sur UPDATE score / saisie prono.
-- Les vues n'étant pas supportées par Realtime, on s'abonne aux tables sources.
alter publication supabase_realtime add table public.matchs;
alter publication supabase_realtime add table public.pronos;
