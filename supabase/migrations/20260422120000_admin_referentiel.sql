-- =============================================================
--  Sprint 5.B — Admin référentiel (competitions + equipes)
-- =============================================================
--
--  Contexte :
--    - Sprint 2 a posé `competitions` + `equipes` avec SELECT ouvert
--      aux authentifiés, et INSERT/UPDATE/DELETE réservés au
--      `service_role` (seed FIFA WC 2026).
--    - Sprint 5.A a ajouté le helper `is_admin(uuid)` + policies
--      admin sur `matchs`.
--    - Sprint 5.B ouvre aux admins globaux l'édition du référentiel
--      via une UI dédiée (CRUD competitions + equipes).
--
--  Changements :
--    1. Policies RLS admin sur `competitions` (INSERT/UPDATE/DELETE).
--    2. Policies RLS admin sur `equipes` (INSERT/UPDATE/DELETE).
--    3. Trigger `equipes_prevent_competition_change`
--       → empêche de déplacer une équipe d'une compétition à une
--         autre (invariant : `matchs` référence l'équipe et la
--         compétition séparément, un transfert casserait la
--         cohérence). Renommer l'équipe reste libre.
--
--  FK existantes (non touchées) qui continuent de jouer leur rôle :
--    - `concours.competition_id → competitions.id ON DELETE RESTRICT`
--      → un admin ne peut pas supprimer une compétition utilisée.
--    - `matchs.competition_id → competitions.id ON DELETE RESTRICT`
--      → idem, erreur 23503 côté UI.
--    - `matchs.equipe_a_id / equipe_b_id → equipes.id ON DELETE
--      RESTRICT` → on ne peut pas supprimer une équipe référencée
--      par un match (même au statut placeholder via null, OK).
--    - `equipes.competition_id → competitions.id ON DELETE CASCADE`
--      → si on supprime une compétition sans matchs ni concours,
--         ses équipes partent avec (cohérent).
--
-- =============================================================

-- =============================================================
--  1. Policies RLS admin sur competitions
-- =============================================================

create policy "competitions_insert_admin"
  on public.competitions
  for insert
  to authenticated
  with check (public.is_admin());

create policy "competitions_update_admin"
  on public.competitions
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "competitions_delete_admin"
  on public.competitions
  for delete
  to authenticated
  using (public.is_admin());

-- =============================================================
--  2. Policies RLS admin sur equipes
-- =============================================================

create policy "equipes_insert_admin"
  on public.equipes
  for insert
  to authenticated
  with check (public.is_admin());

create policy "equipes_update_admin"
  on public.equipes
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "equipes_delete_admin"
  on public.equipes
  for delete
  to authenticated
  using (public.is_admin());

-- =============================================================
--  3. Trigger : empêcher le transfert d'équipe entre compétitions
-- =============================================================
-- `matchs.competition_id` et `matchs.equipe_a_id / equipe_b_id`
-- sont indépendants : si un admin réaffectait une équipe d'une
-- compétition A à une compétition B, les matchs de A pointeraient
-- vers une équipe dont `competition_id = B`. Le seed côté UI
-- (selects d'assignation) filtre sur `competition_id = match.competition_id`,
-- mais rien n'empêche côté BDD qu'un ancien match reste cohérent
-- visuellement mais devienne incohérent logiquement.
--
-- On verrouille donc `competition_id` sur UPDATE. Renommer
-- (`nom`, `code`, `drapeau_url`, `groupe`) reste autorisé.

create or replace function public.equipes_prevent_competition_change()
returns trigger
language plpgsql
as $$
begin
  if old.competition_id is distinct from new.competition_id then
    raise exception 'Cannot move equipe between competitions (equipe_id=%)', old.id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

comment on function public.equipes_prevent_competition_change() is
  'Verrouille equipes.competition_id en UPDATE : une équipe ne peut pas migrer d''une compétition à une autre.';

create trigger equipes_prevent_competition_change
before update on public.equipes
for each row execute function public.equipes_prevent_competition_change();
