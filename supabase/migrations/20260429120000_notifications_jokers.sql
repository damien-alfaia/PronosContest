-- =============================================================
--  Sprint 8.C.4 — Notifications jokers (challenge / gift reçus)
-- =============================================================
--
--  Objectif :
--    Notifier le destinataire d'une action sociale de joker :
--
--      - challenge_received : quand un user consomme un `challenge`
--        ou `double_down` en te ciblant sur un match donné.
--      - gift_received      : quand un user consomme un `gift` en
--        t'offrant un joker d'un autre code (ex : il t'offre un
--        `triple` → tu reçois un slot prêt à l'emploi).
--
--  Pourquoi un trigger sur `user_jokers` plutôt que des `push_notification`
--  directement dans le RPC `use_joker` ?
--    1. La règle "si used_at passe de NULL à non-NULL ET une cible user
--       est renseignée, notifier la cible" est un invariant de données,
--       pas une règle d'API. Le mettre en trigger garantit que toute
--       évolution future (ex : edge function de consommation en batch,
--       ou script d'admin qui force used_at) pousse les notifs sans
--       qu'on ait à répliquer la logique.
--    2. On conserve une séparation nette : le RPC fait la validation et
--       l'UPDATE atomique ; le trigger transpose l'effet en "side-effect
--       notifications". C'est le même pattern que badges / chat /
--       participant_joined du Sprint 6.C.
--
--  Guards :
--    - Transition used_at null → non-null uniquement (pas de re-fire
--      sur des UPDATE ultérieurs qui toucheraient d'autres colonnes).
--    - used_on_target_user_id doit être renseigné (filtre naturel :
--      les boost/info n'ont pas de target user → aucune notif).
--    - Garde supplémentaire `target_user <> caller` (défensif : le RPC
--      interdit déjà de se cibler, mais si quelqu'un écrit directement
--      via service_role, on évite l'auto-notif.)
--
--  Dispatch :
--    - joker_category = 'challenge' (challenge / double_down) et
--      used_on_match_id renseigné  →  challenge_received
--    - joker_code = 'gift'                                  →  gift_received
--    - Tous les autres cas (ex : le "slot offert" du flow gift
--      — joker_code='triple' avec target_user set mais sans match
--      cible, rétrocompat payload Sprint 8.B) ne déclenchent RIEN.
--      C'est voulu : le receveur sera notifié une seule fois par la
--      branche `joker_code = 'gift'` ci-dessus, pas deux fois.
--
--  Rappel rétrocompat :
--    L'existant table `notifications` est inchangé. On étend simplement
--    le CHECK sur `type` (drop + add) pour accepter les 2 nouvelles
--    valeurs. Le front lit via la discriminated union Zod : tant qu'on
--    ajoute dans `NOTIFICATION_TYPE_VALUES`, rien ne casse (les rows
--    des autres types restent valides).
-- =============================================================

-- ---------- 1. Étendre le CHECK sur notifications.type ----------

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
    'gift_received'
  ));

comment on constraint notifications_type_check on public.notifications is
  'Enum des types de notifications : match_result, badge_earned, concours_new_member, chat_mention, challenge_received, gift_received.';

-- ---------- 2. Trigger function ----------

create or replace function public.handle_notifications_on_joker_consumed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category text;
  v_stakes int;
  v_gifted_code text;
begin
  -- Guard : consommation effective (used_at : null → non-null) et
  -- présence d'une cible user. Les boost/info (double, triple, safety_net,
  -- boussole) n'ont pas de target user → ce filtre les écarte naturellement.
  if not (
    old.used_at is null
    and new.used_at is not null
    and new.used_on_target_user_id is not null
  ) then
    return null;
  end if;

  -- Défensif : on ne s'auto-notifie jamais (le RPC l'interdit déjà).
  if new.used_on_target_user_id = new.user_id then
    return null;
  end if;

  v_category := public.joker_category(new.joker_code);

  -- CHALLENGE / DOUBLE_DOWN → challenge_received
  -- Guard additionnel `used_on_match_id is not null` : le "slot offert"
  -- du flow gift (ex : un 'triple' UPDATE avec target_user set mais
  -- match_id null) ne matche PAS ce critère → pas de notif doublon.
  if v_category = 'challenge' and new.used_on_match_id is not null then
    v_stakes := nullif(new.used_payload ->> 'stakes', '')::int;

    perform public.push_notification(
      new.used_on_target_user_id,
      'challenge_received',
      jsonb_build_object(
        'concours_id', new.concours_id,
        'match_id',    new.used_on_match_id,
        'sender_id',   new.user_id,
        'joker_code',  new.joker_code,
        'stakes',      v_stakes
      )
    );

    return null;
  end if;

  -- GIFT → gift_received (la ligne qui porte `joker_code = 'gift'`,
  -- pas le "slot offert" qui porte le code réel du cadeau).
  if new.joker_code = 'gift' then
    v_gifted_code := new.used_payload ->> 'gifted_joker_code';

    perform public.push_notification(
      new.used_on_target_user_id,
      'gift_received',
      jsonb_build_object(
        'concours_id',       new.concours_id,
        'sender_id',         new.user_id,
        'gifted_joker_code', v_gifted_code
      )
    );

    return null;
  end if;

  -- Autres cas (joker_code='triple'/'boussole'/… avec target_user set) :
  -- pas de notif. C'est le slot "offert" du flow gift, le receveur a
  -- déjà été notifié via la branche joker_code='gift' ci-dessus.
  return null;
end;
$$;

comment on function public.handle_notifications_on_joker_consumed() is
  'Pousse challenge_received ou gift_received à la cible d''un joker social consommé. AFTER UPDATE sur user_jokers, SECURITY DEFINER.';

-- ---------- 3. Trigger ----------

drop trigger if exists notifications_on_joker_consumed
  on public.user_jokers;

create trigger notifications_on_joker_consumed
  after update on public.user_jokers
  for each row
  execute function public.handle_notifications_on_joker_consumed();

-- =============================================================
--  Publication Realtime
-- =============================================================
--  La table `notifications` est déjà dans `supabase_realtime` depuis le
--  Sprint 6.C ; rien à ajouter. Le front écoute les INSERT filtrés sur
--  `user_id=eq.${auth.uid()}` et recevra automatiquement les 2 nouveaux
--  types sans modification côté transport.
