-- =============================================================
--  Sprint 6.B — Chat par concours
-- =============================================================
--
--  Objectif :
--    - Table `concours_messages` : un canal de chat par concours,
--      visible/écrit uniquement par ses membres.
--    - MVP immuable : pas d'édition, pas de suppression
--      (ni par l'auteur, ni par l'admin). Si le besoin de
--      modération se manifeste, on ajoutera une colonne
--      `deleted_at` + policies UPDATE dans un sprint ultérieur.
--
--  Décisions :
--    - RLS alignée sur `is_participant(concours_id)` (helper
--      SECURITY DEFINER déjà en place depuis Sprint 2), pour
--      garantir l'accès strict aux membres.
--    - CHECK `char_length(body) between 1 and 1000` en dur : ça
--      coupe le spam et garantit qu'un message vide ne peut pas
--      être inséré même en cas de bug Zod côté front.
--    - Index (concours_id, created_at desc) : sert la pagination
--      remontante (la liste affiche les plus récents en bas) sans
--      trier toute la table.
--    - Publication `supabase_realtime` étendue à la table : le
--      front s'abonne aux INSERT filtrés sur `concours_id=eq.${id}`.
--
--  Invariants :
--    - Un non-membre ne peut NI lire NI écrire — la RLS coupe
--      les deux côtés.
--    - Suppression du concours → cascade des messages.
--    - Suppression du profil → cascade des messages de l'user
--      (cohérent avec la policy `on delete cascade` choisie sur
--      d'autres tables du projet).
-- =============================================================

create table public.concours_messages (
  id uuid primary key default gen_random_uuid(),
  concours_id uuid not null references public.concours(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

comment on table public.concours_messages is
  'Messages de chat d''un concours. Immuables au MVP (pas d''édition, pas de suppression).';

-- Index pour la pagination "remontante" :
-- les requêtes typiques sont `where concours_id = ? order by created_at desc limit ?`.
create index concours_messages_concours_created_idx
  on public.concours_messages (concours_id, created_at desc);

-- =============================================================
--  RLS
-- =============================================================

alter table public.concours_messages enable row level security;

-- SELECT : uniquement les membres du concours
create policy concours_messages_select_members
  on public.concours_messages
  for select
  using (public.is_participant(concours_id));

-- INSERT : uniquement les membres du concours, et seulement à leur
-- propre nom (on vérifie `user_id = auth.uid()` en double sécurité
-- pour empêcher quiconque de parler au nom d'un autre).
create policy concours_messages_insert_members
  on public.concours_messages
  for insert
  with check (
    public.is_participant(concours_id)
    and user_id = auth.uid()
  );

-- UPDATE / DELETE : aucune policy → bloqué pour tout le monde (y
-- compris l'auteur). L'immuabilité est garantie par absence de policy,
-- pas par un trigger (plus simple + plus sûr côté perf).

-- =============================================================
--  Publication Realtime
-- =============================================================
-- On ajoute la table à la publication par défaut pour que le client
-- Supabase puisse s'abonner via `channel().on('postgres_changes', …)`.
-- Le filtrage par `concours_id` est fait côté front ; la RLS confirme
-- côté serveur qu'on ne reçoit que les events sur nos concours.

alter publication supabase_realtime add table public.concours_messages;
