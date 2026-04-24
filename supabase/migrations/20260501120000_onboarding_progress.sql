-- =============================================================
--  Sprint 9 — Semaine 1 : suivi de progression onboarding
-- =============================================================
--
--  Schéma (1 table) :
--    - user_onboarding_progress : 1 ligne par user, persiste les
--      milestones du parcours onboarding (welcome vu, 1er concours
--      rejoint, 1er prono saisi, 1er classement vu, 1er invite envoyé),
--      + la liste des étapes de product tour complétées, + la date
--      à laquelle l'user a refermé la checklist d'activation.
--
--  Pourquoi en DB et pas en localStorage :
--    - Reprise multi-device (signup mobile → continuation desktop).
--    - Analytics côté back : on pourra agréger les funnels (combien
--      de % des users atteignent le 1er prono ? en combien de temps ?).
--    - Survit au clear du cache / navigation privée.
--
--  Création d'une ligne : automatique via trigger sur `profiles`
--  (insertion après création du profil, qui elle-même fait suite à
--  un INSERT sur auth.users via la chaîne Supabase Auth).
--
--  RLS : self-only. Un user ne voit et ne peut modifier que sa
--  propre ligne. Aucune écriture admin / cross-user en Phase 1.
--
-- =============================================================

create table public.user_onboarding_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  welcomed_at timestamptz,
  first_concours_joined_at timestamptz,
  first_prono_saved_at timestamptz,
  first_classement_viewed_at timestamptz,
  first_invite_sent_at timestamptz,
  tour_steps_completed jsonb not null default '[]'::jsonb,
  checklist_dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uop_tour_steps_is_array check (
    jsonb_typeof(tour_steps_completed) = 'array'
  )
);

comment on table public.user_onboarding_progress is
  'Milestones et état du parcours onboarding, 1 ligne par user.';
comment on column public.user_onboarding_progress.tour_steps_completed is
  'Liste des IDs d''étapes de product tour complétées (ex: ["match_card","filters","classement_cta"]).';
comment on column public.user_onboarding_progress.checklist_dismissed_at is
  'Date à laquelle l''user a fermé la checklist d''activation (peut être null s''il ne l''a jamais fermée).';

create trigger uop_set_updated_at
before update on public.user_onboarding_progress
for each row execute function public.set_updated_at();

-- =============================================================
--  RLS — self only
-- =============================================================

alter table public.user_onboarding_progress enable row level security;

create policy "uop_select_self"
  on public.user_onboarding_progress
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "uop_insert_self"
  on public.user_onboarding_progress
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "uop_update_self"
  on public.user_onboarding_progress
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Pas de policy DELETE : la ligne est nettoyée par ON DELETE CASCADE
-- du FK user_id -> auth.users. Un user ne peut pas "reset" son
-- progress manuellement (valeur métier discutable, mais si besoin
-- on ajoutera un RPC dédié).

-- =============================================================
--  Trigger auto-row à la création du profil
-- =============================================================
--
--  Chaîne : INSERT auth.users -> trigger Supabase crée profiles
--           -> ce trigger crée user_onboarding_progress.
--
--  ON CONFLICT DO NOTHING : défense en profondeur si un test ou
--  un reset manuel recrée un profil avec le même id.

create or replace function public.handle_onboarding_row_on_profile_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_onboarding_progress (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

comment on function public.handle_onboarding_row_on_profile_insert() is
  'Crée automatiquement une ligne user_onboarding_progress à la création du profil.';

create trigger profiles_init_onboarding_progress
after insert on public.profiles
for each row execute function public.handle_onboarding_row_on_profile_insert();

-- =============================================================
--  Backfill : créer une ligne pour tous les profils existants
-- =============================================================
--
--  Utile en dev/staging où des comptes ont été créés avant cette
--  migration. En production fresh, la boucle n'aura aucun effet.

insert into public.user_onboarding_progress (user_id)
select p.id
from public.profiles p
on conflict (user_id) do nothing;
