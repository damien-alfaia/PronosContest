-- =============================================================
--  Sprint 5 — Admin matchs
-- =============================================================
--
--  Contexte :
--    - Sprint 3 a posé `matchs` avec INSERT/UPDATE/DELETE réservés
--      au `service_role` (seed + import API futur).
--    - Sprint 4 a branché le scoring via `v_pronos_points` + la vue
--      `v_classement_concours`. Le classement se met à jour dès que
--      `matchs.score_a / score_b / status / vainqueur_tab` change.
--    - Sprint 5 ouvre la saisie manuelle des résultats aux admins
--      globaux (`profiles.role = 'admin'`) via une UI dédiée.
--
--  Changements :
--    1. Équipes nullable sur matchs
--       → les KO WC 2026 sont seedés en placeholder (dates / stades
--         connus, équipes NULL tant que les groupes ne sont pas finis).
--    2. Workflow status complet
--       → ajout de 'postponed' pour couvrir les reports officiels
--         (les autres : 'scheduled', 'live', 'finished', 'cancelled'
--         étaient déjà là).
--    3. Helper `public.is_admin(uuid?)`
--       → SECURITY DEFINER STABLE, lit `profiles.role`. Utilisé par
--         les policies de cette migration et réutilisable pour
--         `competitions` / `equipes` (Sprint 5.B).
--    4. Policies RLS admin sur matchs (INSERT/UPDATE/DELETE)
--    5. Trigger `matchs_prevent_team_change_if_finished`
--       → empêche de réécrire les équipes d'un match terminé
--         (protège l'historique scoring : les pronos référencent
--         match_id, l'issue est déjà scellée).
--
-- =============================================================

-- ---------- 1. Équipes nullable ----------
-- Les matchs KO sont créés avant que les qualifiés ne soient connus.
-- On drop le NOT NULL, le CHECK `matchs_equipes_distinct` reste
-- actif (null <> null → null → pass, donc OK) et les FK
-- `on delete restrict` continuent à protéger l'intégrité quand les
-- équipes sont effectivement renseignées.
alter table public.matchs
  alter column equipe_a_id drop not null;

alter table public.matchs
  alter column equipe_b_id drop not null;

comment on column public.matchs.equipe_a_id is
  'Équipe à domicile. NULL tant que la phase qualificative n''a pas désigné le participant (matchs KO seedés en placeholder).';

comment on column public.matchs.equipe_b_id is
  'Équipe à l''extérieur. NULL tant que la phase qualificative n''a pas désigné le participant (matchs KO seedés en placeholder).';

-- ---------- 2. Workflow status complet ----------
-- L'enum textuel Sprint 3 couvrait déjà scheduled/live/finished/cancelled.
-- On ajoute 'postponed' pour matérialiser un report officiel (distinct
-- d'une annulation : un match reporté finira par être joué).
alter table public.matchs
  drop constraint matchs_status_check;

alter table public.matchs
  add constraint matchs_status_check
  check (status in ('scheduled', 'live', 'finished', 'postponed', 'cancelled'));

comment on column public.matchs.status is
  'Workflow d''un match : scheduled → live → finished. postponed / cancelled sont des états terminaux hors jeu.';

-- =============================================================
--  3. Helper is_admin
-- =============================================================

-- Retourne true si l'utilisateur a `profiles.role = 'admin'`.
-- SECURITY DEFINER pour contourner la RLS de profiles (qui restreint
-- la visibilité des rôles des autres utilisateurs).
-- STABLE car deux appels dans la même transaction renvoient la
-- même valeur.
create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id
      and role = 'admin'
  );
$$;

comment on function public.is_admin(uuid) is
  'Helper RLS : true si profiles.role = ''admin''. SECURITY DEFINER STABLE. Défaut = auth.uid().';

-- =============================================================
--  4. Policies RLS admin sur matchs
-- =============================================================
-- Le SELECT reste la policy Sprint 3 (`matchs_select_all`, lecture
-- publique pour les authentifiés).
-- On ajoute INSERT / UPDATE / DELETE réservés aux admins globaux.

create policy "matchs_insert_admin"
  on public.matchs
  for insert
  to authenticated
  with check (public.is_admin());

create policy "matchs_update_admin"
  on public.matchs
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "matchs_delete_admin"
  on public.matchs
  for delete
  to authenticated
  using (public.is_admin());

-- =============================================================
--  5. Trigger : protéger les équipes d'un match terminé
-- =============================================================
-- Un match `finished` a généré des pronos scorés via
-- `v_pronos_points`. Changer l'identité d'une équipe après coup
-- casserait l'historique et ferait muter le classement d'utilisateurs
-- qui ont pourtant misé en connaissance de cause.
-- On tolère les autres édits (score corrigé par l'admin si erreur
-- de saisie, vainqueur_tab ajusté, etc.) : seul le changement
-- d'équipe est verrouillé.

create or replace function public.matchs_prevent_team_change_if_finished()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'finished' and (
    old.equipe_a_id is distinct from new.equipe_a_id
    or old.equipe_b_id is distinct from new.equipe_b_id
  ) then
    raise exception 'Cannot change teams on a finished match (match_id=%)', old.id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

comment on function public.matchs_prevent_team_change_if_finished() is
  'Protège equipe_a_id / equipe_b_id après status=finished : l''historique de scoring ne doit pas être réécrit.';

create trigger matchs_prevent_team_change_if_finished
before update on public.matchs
for each row execute function public.matchs_prevent_team_change_if_finished();
