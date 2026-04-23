-- =============================================================
--  Sprint 8.B.2 — Jokers : effets sur le scoring
-- =============================================================
--
--  Refonte de `v_pronos_points` + `v_classement_concours` pour
--  intégrer les effets scoring des jokers consommés (Sprint 8.B.1).
--
--  Effets par joker (les jokers d'info/social n'affectent pas le score) :
--
--    ┌──────────────┬──────────┬──────────────────────────────────┐
--    │ joker_code   │ catégorie│ effet scoring                    │
--    ├──────────────┼──────────┼──────────────────────────────────┤
--    │ double       │ boost    │ multiplier ×2 sur points_raw     │
--    │ triple       │ boost    │ multiplier ×3 sur points_raw     │
--    │ safety_net   │ boost    │ plancher : GREATEST(points,1)    │
--    │ challenge    │ challenge│ ±5 pts (transfert caller/target) │
--    │ double_down  │ challenge│ ±10 pts (transfert)              │
--    │ boussole     │ info     │ aucun (affiché dans la grille)   │
--    │ gift         │ social   │ aucun (transfert de slot)        │
--    └──────────────┴──────────┴──────────────────────────────────┘
--
--  Règles d'interaction :
--    - Stacking : Sprint 8.B.1 garantit max 1 boost et max 1 challenge
--      par (user, match). Donc {multiplier>1, safety_net} sont
--      mutuellement exclusifs par construction.
--    - Safety net sans prono : l'user doit avoir pronostiqué sur le
--      match pour que la ligne de `v_pronos_points` existe et que le
--      plancher s'applique. Une utilisation de safety_net sans prono
--      est un slot gaspillé (choix produit v1 : simple et honnête).
--    - Challenge : compare `points_pure = points_base + bonus_ko`
--      (sans cote, sans multiplier) du caller et du target sur le
--      match. Pas de cote ni de multiplier dans la comparaison, pour
--      que le duel évalue la pureté du prono, pas la stratégie joker.
--      Si l'un des deux n'a pas pronostiqué : `points_pure = 0` via
--      LEFT JOIN. Tie (=) → 0 transfert.
--    - Challenge tant que le match n'est pas `is_final` : delta = 0.
--      Devient effectif au moment où le match est finalisé (scores
--      saisis + status='finished').
--
--  Schémas des vues :
--
--    v_pronos_points — conserve les colonnes Sprint 4 (concours_id,
--    user_id, match_id, phase, match_status, is_final, is_exact,
--    points_base, bonus_ko, cote_appliquee) et APPEND des colonnes :
--      - points_pure        int    : base + bonus_ko (sans cote/mult)
--      - joker_multiplier   int    : 1 (défaut), 2 (double), 3 (triple)
--      - joker_safety_net   bool   : true si safety_net actif
--      - points_raw         int    : round((base+bonus)*coalesce(cote,1))
--      - points_final       int    : points_raw*multiplier, floor 1 si
--                                     safety_net et is_final
--    → CREATE OR REPLACE VIEW : ajout en queue de la liste, compatible
--      avec les vues dépendantes (v_classement_concours).
--
--    v_challenge_deltas — NOUVELLE vue (1 ligne par (concours, user))
--    agrégant tous les transferts de challenge / double_down. Exposée
--    pour du debug et pour usage futur en Sprint 8.B.3 (affichage détail).
--
--    v_classement_concours — conserve les colonnes Sprint 4 (concours_id,
--    user_id, prenom, nom, avatar_url, points, pronos_joues,
--    pronos_gagnes, pronos_exacts, rang) et APPEND :
--      - prono_points      int : somme points_final des pronos (≥ 0)
--      - challenge_delta   int : net transfert challenge (peut être <0)
--    La colonne `points` reste l'interface publique (prono_points +
--    challenge_delta). Zod strip les nouvelles colonnes par défaut,
--    rétrocompat avec features/classement sans modification front.
--
--  Compatibilité RLS : security_invoker=on sur toutes les vues
--  (hérite des policies de pronos + user_jokers + concours_participants).
--  user_jokers.SELECT est autorisée self OU même concours, donc un
--  participant voit les jokers (donc les multiplicateurs) de tous les
--  autres participants au moment du calcul du classement → OK.
--
-- =============================================================

-- ---------- 1. v_pronos_points : CREATE OR REPLACE avec colonnes append ----------
--
-- Postgres autorise CREATE OR REPLACE VIEW tant que les colonnes existantes
-- gardent leur nom + type et que les nouvelles sont ajoutées APRÈS.
-- Donc on reproduit à l'identique les 10 premières colonnes (Sprint 4)
-- puis on append 5 nouvelles.

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
),
scored as (
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
  from base
),
with_jokers as (
  -- Left join des jokers boost consommés par (user, match).
  -- La stacking rule de 8.B.1 garantit max 1 boost par (user, match) :
  -- donc au plus une ligne jointe. On prend MAX() par sécurité.
  select
    s.concours_id,
    s.user_id,
    s.match_id,
    s.phase,
    s.match_status,
    s.is_final,
    s.is_exact,
    s.points_base,
    s.bonus_ko,
    s.cote_appliquee,
    (s.points_base + s.bonus_ko) as points_pure,
    coalesce(
      max(
        case uj.joker_code
          when 'double' then 2
          when 'triple' then 3
          else 1
        end
      ),
      1
    ) as joker_multiplier,
    coalesce(
      bool_or(uj.joker_code = 'safety_net'),
      false
    ) as joker_safety_net
  from scored s
  left join public.user_jokers uj
    on uj.concours_id = s.concours_id
    and uj.user_id = s.user_id
    and uj.used_on_match_id = s.match_id
    and uj.used_at is not null
    and uj.joker_code in ('double', 'triple', 'safety_net')
  group by
    s.concours_id, s.user_id, s.match_id, s.phase, s.match_status,
    s.is_final, s.is_exact, s.points_base, s.bonus_ko, s.cote_appliquee
)
select
  concours_id,
  user_id,
  match_id,
  phase,
  match_status,
  is_final,
  is_exact,
  points_base,
  bonus_ko,
  cote_appliquee,
  points_pure,
  joker_multiplier,
  joker_safety_net,
  -- points_raw = formule Sprint 4 (base+bonus)*cote arrondi
  round(
    (points_base + bonus_ko) * coalesce(cote_appliquee, 1.0)
  )::int as points_raw,
  -- points_final = points_raw * multiplier, puis plancher +1 si
  -- safety_net actif et is_final (sinon 0 si pas final).
  case
    when not is_final then 0
    when joker_safety_net then
      greatest(
        round(
          (points_base + bonus_ko) * coalesce(cote_appliquee, 1.0)
        )::int * joker_multiplier,
        1
      )
    else
      round(
        (points_base + bonus_ko) * coalesce(cote_appliquee, 1.0)
      )::int * joker_multiplier
  end as points_final
from with_jokers;

comment on view public.v_pronos_points is
  'Points par prono, enrichi des effets jokers boost (double/triple/safety_net). security_invoker=on → hérite de la RLS de pronos + user_jokers.';

-- ---------- 2. v_challenge_deltas : NOUVELLE vue (transferts nets) ----------
--
-- Agrège pour chaque (concours, user) la somme de tous les transferts
-- de challenge/double_down auxquels il participe (caller OU target),
-- uniquement sur les matchs finalisés. Delta ∈ {-N, 0, +N}.

create or replace view public.v_challenge_deltas
with (security_invoker = on) as
with raw_rows as (
  select
    uj.concours_id,
    uj.user_id as caller_user_id,
    uj.used_on_target_user_id as target_user_id,
    uj.used_on_match_id as match_id,
    case uj.joker_code
      when 'challenge' then 5
      when 'double_down' then 10
    end as stakes
  from public.user_jokers uj
  where uj.used_at is not null
    and uj.joker_code in ('challenge', 'double_down')
    and uj.used_on_match_id is not null
    and uj.used_on_target_user_id is not null
),
resolved as (
  select
    r.concours_id,
    r.caller_user_id,
    r.target_user_id,
    r.match_id,
    r.stakes,
    (
      m.status = 'finished'
      and m.score_a is not null
      and m.score_b is not null
    ) as is_final,
    coalesce(pc.points_pure, 0) as caller_pure,
    coalesce(pt.points_pure, 0) as target_pure
  from raw_rows r
  inner join public.matchs m on m.id = r.match_id
  left join public.v_pronos_points pc
    on pc.concours_id = r.concours_id
    and pc.user_id = r.caller_user_id
    and pc.match_id = r.match_id
  left join public.v_pronos_points pt
    on pt.concours_id = r.concours_id
    and pt.user_id = r.target_user_id
    and pt.match_id = r.match_id
),
unioned as (
  -- Côté caller : +stakes si meilleur, -stakes si pire, 0 sinon.
  select
    concours_id,
    caller_user_id as user_id,
    case
      when not is_final then 0
      when caller_pure > target_pure then stakes
      when caller_pure < target_pure then -stakes
      else 0
    end as delta
  from resolved
  union all
  -- Côté target : miroir exact du caller.
  select
    concours_id,
    target_user_id as user_id,
    case
      when not is_final then 0
      when target_pure > caller_pure then stakes
      when target_pure < caller_pure then -stakes
      else 0
    end as delta
  from resolved
),
aggregated as (
  select
    concours_id,
    user_id,
    coalesce(sum(delta), 0)::int as challenge_delta
  from unioned
  group by concours_id, user_id
)
-- Rendu dense : 1 ligne par participant (délai 0 si non impliqué).
-- Aligne la surface avec v_classement_concours et évite les
-- joins/coalesce côté consommateurs.
select
  cp.concours_id,
  cp.user_id,
  coalesce(a.challenge_delta, 0)::int as challenge_delta
from public.concours_participants cp
left join aggregated a
  on a.concours_id = cp.concours_id
  and a.user_id = cp.user_id;

comment on view public.v_challenge_deltas is
  'Transferts nets de points issus des jokers challenge/double_down par (concours, user). security_invoker=on → hérite de la RLS de user_jokers + pronos.';

grant select on public.v_challenge_deltas to authenticated;

-- ---------- 3. v_classement_concours : CREATE OR REPLACE ----------
--
-- Ajoute `prono_points` et `challenge_delta` en queue. La colonne
-- `points` conserve le même nom et type (int) mais représente
-- maintenant prono_points + challenge_delta. Tri et RANK() basés sur
-- le `points` final.

create or replace view public.v_classement_concours
with (security_invoker = on) as
with per_user as (
  select
    cp.concours_id,
    cp.user_id,
    coalesce(sum(pp.points_final), 0)::int as prono_points,
    count(pp.match_id) filter (where pp.is_final) as pronos_joues,
    count(pp.match_id) filter (where pp.is_final and pp.points_base > 0) as pronos_gagnes,
    count(pp.match_id) filter (where pp.is_final and pp.is_exact) as pronos_exacts
  from public.concours_participants cp
  left join public.v_pronos_points pp
    on pp.concours_id = cp.concours_id
    and pp.user_id = cp.user_id
  group by cp.concours_id, cp.user_id
),
with_deltas as (
  select
    pu.concours_id,
    pu.user_id,
    pu.prono_points,
    coalesce(cd.challenge_delta, 0)::int as challenge_delta,
    (pu.prono_points + coalesce(cd.challenge_delta, 0))::int as points,
    pu.pronos_joues,
    pu.pronos_gagnes,
    pu.pronos_exacts
  from per_user pu
  left join public.v_challenge_deltas cd
    on cd.concours_id = pu.concours_id
    and cd.user_id = pu.user_id
)
select
  wd.concours_id,
  wd.user_id,
  pr.prenom,
  pr.nom,
  pr.avatar_url,
  wd.points,
  wd.pronos_joues,
  wd.pronos_gagnes,
  wd.pronos_exacts,
  rank() over (
    partition by wd.concours_id
    order by
      wd.points desc,
      wd.pronos_exacts desc,
      wd.pronos_gagnes desc
  ) as rang,
  wd.prono_points,
  wd.challenge_delta
from with_deltas wd
left join public.profiles pr on pr.id = wd.user_id;

comment on view public.v_classement_concours is
  'Classement agrégé par concours (points = prono_points + challenge_delta). Colonnes `prono_points` et `challenge_delta` exposées pour affichage détaillé. security_invoker=on.';

grant select on public.v_classement_concours to authenticated;
