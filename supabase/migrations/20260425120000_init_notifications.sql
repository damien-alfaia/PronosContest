-- =============================================================
--  Sprint 6.C — Notifications in-app
-- =============================================================
--
--  Objectif :
--    Canal de notifications par user, alimenté exclusivement par
--    des triggers SECURITY DEFINER attachés à 4 sources métier :
--
--      - matchs (UPDATE status -> 'finished') → match_result
--      - user_badges (INSERT)                  → badge_earned
--      - concours_participants (INSERT)        → concours_new_member
--      - concours_messages (INSERT)            → chat_mention
--
--  Principes :
--    - Aucun INSERT/DELETE depuis le client (pas de policy) → tout
--      passe par les triggers ci-dessous, qui écrivent en
--      SECURITY DEFINER et contournent la RLS.
--    - UPDATE self autorisé pour pouvoir marquer `read_at`, mais
--      toutes les autres colonnes sont rendues immuables par un
--      trigger BEFORE UPDATE (sécurité "column-level").
--    - Publication `supabase_realtime` étendue : le front écoute
--      les INSERT filtrés sur `user_id=eq.${auth.uid()}`.
--    - Index `(user_id, created_at desc)` pour la liste ;
--      index partiel `(user_id) where read_at is null` pour le
--      compteur non-lues.
--
--  i18n :
--    Titre / corps sont volontairement NULLABLES. Les triggers
--    laissent ces champs vides et le front résout les libellés
--    localisés à partir de (type, payload) via react-i18next.
--    Cela évite toute chaîne localisée dans la DB, et laisse la
--    porte ouverte à d'éventuelles notifs admin custom (ex :
--    "Maintenance programmée") qui rempliraient title/body en dur.
-- =============================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'match_result', 'badge_earned', 'concours_new_member', 'chat_mention'
  )),
  title text,
  body text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_payload_is_object check (
    jsonb_typeof(payload) = 'object'
  )
);

comment on table public.notifications is
  'Notifications in-app par user. Alimenté par triggers SECURITY DEFINER uniquement.';
comment on column public.notifications.type is
  'Type discriminant pour le rendu front : match_result | badge_earned | concours_new_member | chat_mention';
comment on column public.notifications.payload is
  'Données typées par `type`, résolues côté front (ex: {"match_id":"...","score_a":2,"score_b":1}).';
comment on column public.notifications.read_at is
  'Horodatage du passage à "lu". NULL = non-lue (sert à l index partiel).';

-- Liste triée la plus récente d'abord : index couvrant.
create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

-- Compteur non-lues : index partiel ultra-léger pour COUNT(*) filtré.
create index notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

-- =============================================================
--  Immuabilité "column-level" : seule `read_at` est mutable
-- =============================================================
--  Une policy RLS n'exprime pas directement la restriction au niveau
--  colonne. On passe donc par un trigger BEFORE UPDATE qui restaure
--  toutes les colonnes non-read_at aux valeurs d'OLD. Si le client
--  tente de réécrire title/body/payload, le trigger annule en
--  silence la modification.

create or replace function public.notifications_prevent_content_update()
returns trigger
language plpgsql
as $$
begin
  new.id         := old.id;
  new.user_id    := old.user_id;
  new.type       := old.type;
  new.title      := old.title;
  new.body       := old.body;
  new.payload    := old.payload;
  new.created_at := old.created_at;
  -- Seule `read_at` garde la valeur fournie par le client.
  return new;
end;
$$;

create trigger notifications_prevent_content_update
  before update on public.notifications
  for each row execute function public.notifications_prevent_content_update();

-- =============================================================
--  RLS
-- =============================================================

alter table public.notifications enable row level security;

-- SELECT : self uniquement.
create policy notifications_select_self
  on public.notifications
  for select
  using (user_id = auth.uid());

-- UPDATE : self uniquement. Le trigger ci-dessus confine la
-- mutation effective à `read_at`.
create policy notifications_update_self
  on public.notifications
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- INSERT/DELETE : aucune policy → réservé aux triggers
-- SECURITY DEFINER et au service_role (admin broadcasts futurs).

-- =============================================================
--  HELPER : insertion idempotente (pour triggers)
-- =============================================================
--  On N'UTILISE PAS de déduplication via UNIQUE index ici : une
--  notif "match X terminé" ne peut de toute façon se produire
--  qu'une fois (guard sur la transition status -> 'finished').
--  `push_notification` est surtout là pour centraliser le search_path
--  et permettre au front-end-agent de retrouver le helper dans les
--  tests SQL.

create or replace function public.push_notification(
  p_user_id uuid,
  p_type text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, type, payload)
  values (p_user_id, p_type, coalesce(p_payload, '{}'::jsonb));
$$;

comment on function public.push_notification(uuid, text, jsonb) is
  'Insertion d''une notification pour un user donné. Utilisée par les triggers métier.';

-- =============================================================
--  TRIGGER #1 — Match terminé
-- =============================================================
--  AFTER UPDATE ON matchs, WHEN status transitions to 'finished'
--  avec des scores présents.
--
--  Stratégie : 1 notif par user unique ayant au moins un concours
--  utilisant cette compétition. On ne duplique PAS par concours
--  (éviterait du spam pour les users inscrits à plusieurs concours
--  sur la même compétition). L'user verra la notif, cliquera, et
--  navigera vers /app/concours pour voir quel classement a bougé.
--
--  Guard : ne fire que si `old.status` était distinct de 'finished'
--  (évite le re-fire quand un admin corrige un score sur un match
--  déjà finished — ce re-fire est souhaité côté scoring mais pas
--  côté notifs : on ne spamme pas les users pour une correction).

create or replace function public.handle_notifications_on_match_finished()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_payload jsonb;
begin
  if not (new.status = 'finished'
          and new.score_a is not null
          and new.score_b is not null
          and old.status is distinct from 'finished') then
    return null;
  end if;

  v_payload := jsonb_build_object(
    'match_id',       new.id,
    'competition_id', new.competition_id,
    'score_a',        new.score_a,
    'score_b',        new.score_b,
    'equipe_a_id',    new.equipe_a_id,
    'equipe_b_id',    new.equipe_b_id,
    'vainqueur_tab',  new.vainqueur_tab
  );

  for v_user in
    select distinct cp.user_id
    from public.concours_participants cp
    inner join public.concours c on c.id = cp.concours_id
    where c.competition_id = new.competition_id
  loop
    perform public.push_notification(v_user, 'match_result', v_payload);
  end loop;

  return null;
end;
$$;

create trigger notifications_on_match_finished
  after update on public.matchs
  for each row execute function public.handle_notifications_on_match_finished();

-- =============================================================
--  TRIGGER #2 — Badge gagné
-- =============================================================
--  AFTER INSERT ON user_badges : l'idempotence étant déjà garantie
--  par `ON CONFLICT DO NOTHING` côté award_badge (Sprint 6.A), on
--  ne pousse une notif QUE si l'INSERT a effectivement créé une
--  ligne (l'AFTER trigger ne fire que sur les lignes réellement
--  insérées, pas sur les conflits DO NOTHING).

create or replace function public.handle_notifications_on_badge_earned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.push_notification(
    new.user_id,
    'badge_earned',
    jsonb_build_object(
      'badge_code',   new.badge_code,
      'earned_at',    new.earned_at,
      'metadata',     new.metadata
    )
  );
  return null;
end;
$$;

create trigger notifications_on_badge_earned
  after insert on public.user_badges
  for each row execute function public.handle_notifications_on_badge_earned();

-- =============================================================
--  TRIGGER #3 — Nouveau membre dans un de mes concours
-- =============================================================
--  AFTER INSERT ON concours_participants : on notifie l'owner du
--  concours quand quelqu'un d'autre que lui rejoint.
--
--  Guards :
--    - NEW.user_id <> owner_id : l'owner qui s'auto-ajoute
--      (trigger handle_new_concours) ne se notifie pas lui-même.
--    - Role 'admin' sur l'auto-insert de l'owner → on skip aussi
--      pour être doublement sûr.

create or replace function public.handle_notifications_on_participant_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_concours_nom text;
begin
  -- Skip l'auto-join admin (owner s'auto-ajoute)
  if new.role = 'admin' then
    return null;
  end if;

  select owner_id, nom
    into v_owner_id, v_concours_nom
  from public.concours
  where id = new.concours_id;

  if v_owner_id is null or v_owner_id = new.user_id then
    return null;
  end if;

  perform public.push_notification(
    v_owner_id,
    'concours_new_member',
    jsonb_build_object(
      'concours_id',   new.concours_id,
      'concours_nom',  v_concours_nom,
      'new_user_id',   new.user_id
    )
  );

  return null;
end;
$$;

create trigger notifications_on_participant_joined
  after insert on public.concours_participants
  for each row execute function public.handle_notifications_on_participant_joined();

-- =============================================================
--  TRIGGER #4 — Mention dans un message de chat
-- =============================================================
--  AFTER INSERT ON concours_messages : on scanne `body` pour des
--  tokens de mention et on les résout contre les participants du
--  concours.
--
--  Stratégie de résolution en 2 passes (priorité full-name) :
--
--    Pass 1 — `@Prénom Nom` (deux tokens séparés par un espace) :
--      lookup `lower(prenom) || ' ' || lower(nom)`. Permet de
--      lever l'ambiguïté quand plusieurs participants partagent
--      le même prénom (ex : Alice Martin / Alice Bernard).
--      `payload.match_type = 'full_name'`.
--
--    Pass 2 — `@Prénom` seul : fallback. Notifie uniquement si
--      le prénom est UNIQUE parmi les participants du concours.
--      `payload.match_type = 'first_name'`.
--
--  Règles communes MVP :
--    - Comparaison case-insensitive (`lower()`).
--    - On n'auto-mentionne pas : si NEW.user_id est la cible
--      ("@Alice Martin" écrit par Alice Martin), on skip.
--    - Déduplication par user cible : un même participant ne reçoit
--      qu'une seule notif par message, même si mentionné plusieurs
--      fois ou à la fois par full-name et par prénom.
--    - Aucune notif si le match est ambigu (count > 1) ou inexistant
--      (faute de frappe). Mieux vaut zéro notif qu'une notif erronée.
--
--  Regex :
--    - Pass 1 : `@([A-Za-zÀ-ÿ0-9\-]{2,}) ([A-Za-zÀ-ÿ0-9\-]{2,})`
--      Le tiret reste dans le token (noms composés type "Jean-Pierre"
--      ou "Al-Hilal"). L'espace simple est le séparateur.
--    - Pass 2 : `@([A-Za-zÀ-ÿ0-9_\-]{2,})` — idem Sprint précédent,
--      conservé pour ramasser les mentions courtes.
--  `[[:alpha:]]` ne couvre pas toujours les accents sous pg, donc
--  on énumère explicitement la plage `À-ÿ`.

create or replace function public.handle_notifications_on_chat_mention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match record;
  v_count int;
  v_target uuid;
  v_seen_users uuid[];
begin
  v_seen_users := array[]::uuid[];

  -- ------------------------------------------------------------
  -- Pass 1 : `@Prénom Nom` (full name, 2 tokens)
  -- ------------------------------------------------------------
  for v_match in
    select distinct
      lower(m[1]) as prenom,
      lower(m[2]) as nom
    from regexp_matches(
      new.body,
      '@([A-Za-zÀ-ÿ0-9\-]{2,}) ([A-Za-zÀ-ÿ0-9\-]{2,})',
      'g'
    ) as m
  loop
    select count(*), (array_agg(cp.user_id))[1]
      into v_count, v_target
    from public.concours_participants cp
    inner join public.profiles p on p.id = cp.user_id
    where cp.concours_id = new.concours_id
      and lower(p.prenom) = v_match.prenom
      and lower(p.nom) = v_match.nom;

    if v_count = 1
       and v_target is not null
       and v_target <> new.user_id
       and not (v_target = any(v_seen_users))
    then
      perform public.push_notification(
        v_target,
        'chat_mention',
        jsonb_build_object(
          'concours_id',   new.concours_id,
          'message_id',    new.id,
          'mentioned_by',  new.user_id,
          'token',         v_match.prenom || ' ' || v_match.nom,
          'match_type',    'full_name',
          'body_preview',  left(new.body, 140)
        )
      );
      v_seen_users := array_append(v_seen_users, v_target);
    end if;
  end loop;

  -- ------------------------------------------------------------
  -- Pass 2 : `@Prénom` seul (fallback unicité prénom)
  -- v_seen_users empêche le double-notify si le user était déjà
  -- ramassé en pass 1 par son full-name.
  -- ------------------------------------------------------------
  for v_match in
    select distinct lower(m[1]) as prenom
    from regexp_matches(
      new.body,
      '@([A-Za-zÀ-ÿ0-9_\-]{2,})',
      'g'
    ) as m
  loop
    select count(*), (array_agg(cp.user_id))[1]
      into v_count, v_target
    from public.concours_participants cp
    inner join public.profiles p on p.id = cp.user_id
    where cp.concours_id = new.concours_id
      and lower(p.prenom) = v_match.prenom;

    if v_count = 1
       and v_target is not null
       and v_target <> new.user_id
       and not (v_target = any(v_seen_users))
    then
      perform public.push_notification(
        v_target,
        'chat_mention',
        jsonb_build_object(
          'concours_id',   new.concours_id,
          'message_id',    new.id,
          'mentioned_by',  new.user_id,
          'token',         v_match.prenom,
          'match_type',    'first_name',
          'body_preview',  left(new.body, 140)
        )
      );
      v_seen_users := array_append(v_seen_users, v_target);
    end if;
  end loop;

  return null;
end;
$$;

create trigger notifications_on_chat_mention
  after insert on public.concours_messages
  for each row execute function public.handle_notifications_on_chat_mention();

-- =============================================================
--  Publication Realtime
-- =============================================================
--  Le front s'abonne via
--  `channel('user-notifs:${userId}').on('postgres_changes', {event:'*',
--       schema:'public', table:'notifications',
--       filter:`user_id=eq.${userId}`}, cb)`.
--  La RLS confirme côté serveur qu'on ne reçoit que nos propres rows.

alter publication supabase_realtime add table public.notifications;
