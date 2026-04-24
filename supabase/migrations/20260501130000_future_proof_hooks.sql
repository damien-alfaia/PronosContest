-- =============================================================
--  Sprint 9 — Semaine 1 : crochets Phase 2 (inertes en Phase 1)
-- =============================================================
--
--  Objectif : poser dès maintenant les colonnes nécessaires pour
--  les modèles économiques candidats de la Phase 2 (post-CdM 2026).
--  Coût aujourd'hui ~= 0 (default 'free' / false / {}). Gain plus
--  tard : pas de refactor de schéma quand on branchera un vrai
--  feature gating, du sponsoring ou du white-label.
--
--  Aucune policy n'est ajoutée — ces colonnes ne sont lues par
--  aucun helper ni par aucun composant en Phase 1. Elles existent,
--  c'est tout.
--
--  Valeurs futures possibles :
--    - profiles.plan_code :
--        'free'    (default, inchangé tant qu'on ne monétise pas)
--        'host'    (créateurs de concours, ~4,99 €/mois)
--        'pro'     (influenceurs, ~14,99 €/mois)
--        'sponsor' (partenaire commercial B2B)
--    - concours.is_sponsored / sponsor_brand :
--        concours financé par un partenaire (affichage branding).
--    - concours.paid_features :
--        flags de features Premium activées sur ce concours précis
--        (ex: {"custom_banner":true,"analytics_advanced":true}).
--
-- =============================================================

-- ---------- profiles.plan_code ----------
alter table public.profiles
  add column plan_code text not null default 'free'
  constraint profiles_plan_code_check check (
    plan_code in ('free', 'host', 'pro', 'sponsor')
  );

comment on column public.profiles.plan_code is
  'Plan d''abonnement. Inerte en Phase 1 (toujours ''free''). Utilisé en Phase 2.';

create index profiles_plan_code_idx
  on public.profiles(plan_code)
  where plan_code <> 'free';

-- ---------- concours.is_sponsored ----------
alter table public.concours
  add column is_sponsored boolean not null default false;

comment on column public.concours.is_sponsored is
  'Flag concours sponsorisé (branding partenaire). Inerte en Phase 1.';

-- ---------- concours.sponsor_brand ----------
alter table public.concours
  add column sponsor_brand text;

comment on column public.concours.sponsor_brand is
  'Nom de la marque qui sponsorise ce concours (null si non sponsorisé).';

-- ---------- concours.paid_features ----------
alter table public.concours
  add column paid_features jsonb not null default '{}'::jsonb
  constraint concours_paid_features_is_object check (
    jsonb_typeof(paid_features) = 'object'
  );

comment on column public.concours.paid_features is
  'Flags de features Premium activées pour ce concours. Inerte en Phase 1.';

-- Index partiel : seuls les concours sponsorisés sont probablement
-- requêtés par cette colonne (analytics, page "sponsors").
create index concours_sponsored_idx
  on public.concours(id)
  where is_sponsored = true;
