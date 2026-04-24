-- =============================================================
--  Sprint 9 — Semaine 3 : viral loop (referrals + milestone joker)
-- =============================================================
--
--  Objectif : tracer qui a fait rejoindre qui, et récompenser les
--  ambassadeurs tous les 3 invités qui rejoignent effectivement.
--
--  Schéma (1 colonne, 1 extension de CHECK, 3 triggers) :
--
--  1. `concours_participants.referrer_id uuid null` : le profile qui
--     a invité cet user à rejoindre. Null si auto-join (public /
--     création) ou si l'user n'a pas indiqué de referrer (entrée
--     directe via code sans `?ref=`).
--
--  2. `notifications_type_check` étendu avec `referral_milestone`.
--
--  3. Trigger `handle_referral_milestone` AFTER INSERT ON cp :
--     à chaque 3e invité qui rejoint, offre 1 joker `double` au
--     referrer (via `user_jokers`, acquired_from='gift') ET insère
--     une notification `referral_milestone` avec le count cumulé.
--     Le joker est offert uniquement si `concours.jokers_enabled =
--     true` (sinon ça n'aurait aucun effet — la feature jokers est
--     opt-in par concours depuis Sprint 8).
--
--  4. Trigger `handle_onboarding_first_invite` AFTER INSERT ON cp :
--     quand un user rejoint avec `referrer_id = X`, marque
--     `user_onboarding_progress.first_invite_sent_at` pour X (cet
--     user a bien envoyé au moins 1 invitation qui a converti).
--
--  5. RPC `join_concours_by_code` étendu avec `p_referrer_id uuid
--     default null` pour permettre de tracer via URL `?ref=<uuid>`.
--     L'ancienne signature (`p_code text`) reste valide en fallback.
-- =============================================================

-- ---------- 1. Colonne referrer_id ----------
alter table public.concours_participants
  add column referrer_id uuid references public.profiles(id) on delete set null;

comment on column public.concours_participants.referrer_id is
  'Profile qui a invité cet user (null = auto-join direct). Set null on delete du referrer.';

-- Index partiel : les requêtes "combien d'invités Y a-t-il fait rejoindre ?"
-- ne concernent que les lignes avec referrer défini. Index partiel plus
-- léger qu'un index global.
create index concours_participants_referrer_idx
  on public.concours_participants(referrer_id)
  where referrer_id is not null;

-- ---------- 2. Extension CHECK notifications.type ----------
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'match_result',
    'badge_earned',
    'concours_new_member',
    'chat_mention',
    'challenge_received',
    'gift_received',
    'referral_milestone'
  ));

-- ---------- 3. Trigger milestone (joker + notif) ----------

create or replace function public.handle_referral_milestone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_jokers_enabled boolean;
begin
  -- Guard : seulement si on a un referrer
  if new.referrer_id is null then return new; end if;

  -- Guard : ne pas compter l'auto-parrainage (si quelqu'un met son
  -- propre id dans ?ref=, on ignore)
  if new.referrer_id = new.user_id then return new; end if;

  -- Compte le cumul d'invités rejoints par ce referrer, TOUS concours
  -- confondus (la promesse est "invite 3 potes = joker", pas "par
  -- concours"). Le count inclut la ligne qu'on vient d'insérer.
  select count(*)
    into v_count
  from public.concours_participants
  where referrer_id = new.referrer_id
    and user_id <> new.referrer_id;

  -- Milestone tous les 3 : 3, 6, 9, 12, …
  if v_count > 0 and v_count % 3 = 0 then
    -- Vérifie que le concours a jokers activés avant d'offrir.
    -- Si jokers_enabled=false, on donne quand même la notif mais
    -- pas le joker (la notif reste motivante).
    select jokers_enabled
      into v_jokers_enabled
    from public.concours
    where id = new.concours_id;

    if coalesce(v_jokers_enabled, false) = true then
      insert into public.user_jokers (user_id, concours_id, joker_code, acquired_from)
      values (new.referrer_id, new.concours_id, 'double', 'gift')
      on conflict do nothing;
    end if;

    insert into public.notifications (user_id, type, payload)
    values (
      new.referrer_id,
      'referral_milestone',
      jsonb_build_object(
        'count', v_count,
        'concours_id', new.concours_id,
        'joker_granted', coalesce(v_jokers_enabled, false)
      )
    );
  end if;

  return new;
end;
$$;

comment on function public.handle_referral_milestone() is
  'Récompense un ambassadeur tous les 3 invités rejoignants (joker + notif).';

drop trigger if exists referral_milestone on public.concours_participants;
create trigger referral_milestone
after insert on public.concours_participants
for each row execute function public.handle_referral_milestone();

-- ---------- 4. Trigger first_invite_sent_at ----------
--
--  Convention : on considère que X a "envoyé une invitation" dès qu'un
--  user rejoint avec referrer_id = X. Ça reste déclenché par une
--  action validée (quelqu'un a cliqué et rejoint) plutôt qu'un simple
--  click de partage côté client, plus fiable.

create or replace function public.handle_onboarding_first_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.referrer_id is null then return new; end if;
  if new.referrer_id = new.user_id then return new; end if;

  update public.user_onboarding_progress
     set first_invite_sent_at = now()
   where user_id = new.referrer_id
     and first_invite_sent_at is null;

  return new;
end;
$$;

comment on function public.handle_onboarding_first_invite() is
  'Marque first_invite_sent_at à la 1re invitation convertie (idempotent).';

drop trigger if exists onboarding_first_invite on public.concours_participants;
create trigger onboarding_first_invite
after insert on public.concours_participants
for each row execute function public.handle_onboarding_first_invite();

-- ---------- 5. RPC join_concours_by_code étendu ----------
--
--  Ajout d'un paramètre optionnel p_referrer_id. L'ancienne signature
--  (p_code text uniquement) est remplacée. PostgreSQL permet de
--  re-créer la fonction avec CREATE OR REPLACE tant que les types
--  et l'ordre des param existants ne changent pas. On ajoute le
--  nouveau param AVEC default null pour rester compatible avec les
--  appelants existants qui ne passent que `{p_code}`.

create or replace function public.join_concours_by_code(
  p_code text,
  p_referrer_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_concours_id uuid;
  v_visibility text;
begin
  if p_code is null or length(p_code) = 0 then
    raise exception 'code_required' using errcode = 'P0001';
  end if;

  select id, visibility
    into v_concours_id, v_visibility
  from public.concours
  where code_invitation = upper(trim(p_code));

  if v_concours_id is null then
    raise exception 'concours_not_found' using errcode = 'P0001';
  end if;

  if v_visibility not in ('private', 'unlisted') then
    raise exception 'concours_not_joinable' using errcode = 'P0001';
  end if;

  insert into public.concours_participants (concours_id, user_id, role, referrer_id)
  values (
    v_concours_id,
    auth.uid(),
    'member',
    -- Auto-protection : on ignore un referrer égal au user courant
    -- (cas edge : quelqu'un met son propre id dans ?ref=).
    case when p_referrer_id is distinct from auth.uid() then p_referrer_id else null end
  )
  on conflict do nothing;

  return v_concours_id;
end;
$$;

comment on function public.join_concours_by_code(text, uuid) is
  'Rejoint un concours via code d''invitation. Optionally tracks le referrer pour la milestone viral.';
