-- =============================================================
--  Sprint 8.B.1 — Jokers (consommation : RPC use_joker + contraintes)
-- =============================================================
--
--  Complète le schéma Sprint 8.A (`init_jokers.sql`) en posant :
--
--    1. Un index unique partiel qui garantit qu'un joker d'un code donné
--       ne peut être consommé qu'une seule fois sur un match donné par
--       un user. Protège contre les double-submit côté client.
--
--    2. Un helper `joker_category(code)` qui retourne la catégorie du
--       joker (boost/info/challenge/social) — simple lookup stable.
--
--    3. Un helper SECURITY DEFINER `boussole_most_common_score(concours,
--       match)` qui n'expose QUE l'agrégat (score_a, score_b, count)
--       du score exact le plus fréquent parmi les pronos du concours
--       sur le match. Jamais les lignes unitaires, pour ne pas révéler
--       le prono d'un joueur particulier avant kick_off (la RLS de
--       `pronos` bloque déjà la lecture croisée avant kick-off, mais
--       le helper doit tourner en SECURITY DEFINER pour agréger sur le
--       concours entier — la revue d'accès se fait en amont via le
--       check "caller est participant").
--
--    4. Le RPC `use_joker(p_user_joker_id, p_target_match_id,
--       p_target_user_id, p_payload)` SECURITY DEFINER qui valide par
--       joker_code et écrit la consommation de manière transactionnelle.
--
--  Règles d'usage par joker_code :
--
--    ┌──────────────┬─────────┬──────────┬──────────────────────────┐
--    │ code         │ target  │ target   │ payload                  │
--    │              │ match   │ user     │                          │
--    ├──────────────┼─────────┼──────────┼──────────────────────────┤
--    │ double       │ requis  │ interdit │ null                     │
--    │ triple       │ requis  │ interdit │ null                     │
--    │ safety_net   │ requis  │ interdit │ null                     │
--    │ boussole     │ requis  │ interdit │ {score_a,score_b,count}  │
--    │ challenge    │ requis  │ requis   │ {stakes:5}               │
--    │ double_down  │ requis  │ requis   │ {stakes:10}              │
--    │ gift         │ interdit│ requis   │ {gifted_joker_code,…}    │
--    └──────────────┴─────────┴──────────┴──────────────────────────┘
--
--  Verrouillage temporel :
--    - double / triple / safety_net / boussole / challenge / double_down
--      exigent `not is_match_locked(match_id)` (utilisation avant kick-off).
--    - `gift` est autorisé tant que le concours vit (pas de cible match).
--
--  Category stacking :
--    - Max 1 joker par (user, match) dans la catégorie `boost`
--      (ne pas empiler double + triple + safety_net).
--    - Max 1 joker par (user, match) dans la catégorie `challenge`
--      (pas de challenge + double_down sur le même match).
--    - `info` (boussole) : 1 seul est dispo au catalogue donc l'unique
--      index partiel (joker_code) suffit.
--    - `social` (gift) : pas de match cible, l'index partiel joker_code
--      ne s'applique pas ; pas de limite category (un user peut offrir
--      plusieurs jokers dans la même soirée s'il en possède).
--
--  Cible cross-references :
--    - target_match_id doit appartenir à la même compétition que le
--      concours du slot.
--    - target_user_id (challenge/gift) doit être participant du concours
--      (via `is_participant` n'est pas utilisable car il lit `auth.uid()` ;
--      on fait un EXISTS direct sur `concours_participants`).
--    - Interdiction de se cibler soi-même (challenge, gift).
--
--  Retour : la ligne `user_jokers` consommée (le slot du caller). Pour
--  `gift`, c'est le slot du joker `gift` lui-même. Le front récupère
--  ainsi la confirmation et peut recharger via invalidation/Realtime.
--
-- =============================================================

-- ---------- 1. Index unique partiel : consommation par match ----------

create unique index user_jokers_unique_used_per_match
  on public.user_jokers(user_id, concours_id, used_on_match_id, joker_code)
  where used_at is not null and used_on_match_id is not null;

comment on index public.user_jokers_unique_used_per_match is
  'Garantit qu''un joker d''un code donné ne peut être consommé qu''une fois sur un match donné par un user.';

-- ---------- 2. Helper joker_category ----------

create or replace function public.joker_category(p_code text)
returns text
language sql
stable
set search_path = public
as $$
  select category from public.jokers where code = p_code;
$$;

comment on function public.joker_category(text) is
  'Retourne la catégorie (boost/info/challenge/social) d''un joker depuis son code.';

-- ---------- 3. Helper boussole_most_common_score ----------

create or replace function public.boussole_most_common_score(
  p_concours_id uuid,
  p_match_id uuid
)
returns table (
  score_a int,
  score_b int,
  count int
)
language sql
security definer
stable
set search_path = public
as $$
  with tally as (
    select
      p.score_a,
      p.score_b,
      count(*)::int as c
    from public.pronos p
    where p.concours_id = p_concours_id
      and p.match_id = p_match_id
    group by p.score_a, p.score_b
  ),
  ranked as (
    select score_a, score_b, c, max(c) over () as max_c
    from tally
  )
  select score_a, score_b, c
  from ranked
  where c = max_c
  order by score_a desc, score_b desc
  limit 1;
$$;

comment on function public.boussole_most_common_score(uuid, uuid) is
  'Retourne (score_a, score_b, count) du score exact le plus fréquent parmi les pronos du concours sur un match. SECURITY DEFINER pour agréger sans exposer les lignes unitaires. En cas d''ex-aequo, renvoie le score le plus haut.';

-- ---------- 4. RPC use_joker ----------

create or replace function public.use_joker(
  p_user_joker_id uuid,
  p_target_match_id uuid default null,
  p_target_user_id uuid default null,
  p_payload jsonb default null
)
returns public.user_jokers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_slot public.user_jokers%rowtype;
  v_code text;
  v_category text;
  v_concours_id uuid;
  v_competition_id uuid;
  v_match_competition uuid;
  v_stakes int;
  v_gifted_code text;
  v_gifted_slot public.user_jokers%rowtype;
  v_new_target_slot public.user_jokers%rowtype;
  v_payload jsonb;
  v_bs_score_a int;
  v_bs_score_b int;
  v_bs_count int;
begin
  -- 4.1 Auth
  if v_caller is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- 4.2 Ownership + slot dispo (FOR UPDATE : sérialise les consommations
  -- concurrentes sur le même slot)
  select * into v_slot
  from public.user_jokers
  where id = p_user_joker_id
  for update;

  if not found then
    raise exception 'joker_not_found' using errcode = 'P0002';
  end if;
  if v_slot.user_id <> v_caller then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if v_slot.used_at is not null then
    raise exception 'already_used' using errcode = '22023';
  end if;

  v_code := v_slot.joker_code;
  v_concours_id := v_slot.concours_id;
  v_category := public.joker_category(v_code);

  -- 4.3 Concours doit avoir jokers_enabled
  select competition_id into v_competition_id
  from public.concours
  where id = v_concours_id;
  if v_competition_id is null then
    raise exception 'concours_not_found' using errcode = 'P0002';
  end if;
  if not public.is_concours_jokers_enabled(v_concours_id) then
    raise exception 'jokers_disabled' using errcode = '22023';
  end if;

  -- ================================================================
  -- 4.4 Dispatch par joker_code
  -- ================================================================

  if v_code in ('double', 'triple', 'safety_net') then
    -- ------ BOOST : cible un match, pas de target_user ------
    if p_target_match_id is null then
      raise exception 'target_match_required' using errcode = '22023';
    end if;
    if p_target_user_id is not null then
      raise exception 'target_user_forbidden' using errcode = '22023';
    end if;

    select competition_id into v_match_competition
    from public.matchs where id = p_target_match_id;
    if v_match_competition is null then
      raise exception 'target_match_not_found' using errcode = 'P0002';
    end if;
    if v_match_competition <> v_competition_id then
      raise exception 'target_match_wrong_competition' using errcode = '22023';
    end if;

    if public.is_match_locked(p_target_match_id) then
      raise exception 'match_locked' using errcode = '22023';
    end if;

    -- Category stacking : max 1 boost par (user, match)
    if exists (
      select 1
      from public.user_jokers uj
      inner join public.jokers j on j.code = uj.joker_code
      where uj.user_id = v_caller
        and uj.concours_id = v_concours_id
        and uj.used_on_match_id = p_target_match_id
        and uj.used_at is not null
        and j.category = 'boost'
    ) then
      raise exception 'category_already_used_on_match' using errcode = '23505';
    end if;

    update public.user_jokers
    set used_at = now(),
        used_on_match_id = p_target_match_id
    where id = p_user_joker_id
    returning * into v_slot;

    return v_slot;

  elsif v_code = 'boussole' then
    -- ------ INFO : cible un match, payload agrégat auto ------
    if p_target_match_id is null then
      raise exception 'target_match_required' using errcode = '22023';
    end if;
    if p_target_user_id is not null then
      raise exception 'target_user_forbidden' using errcode = '22023';
    end if;

    select competition_id into v_match_competition
    from public.matchs where id = p_target_match_id;
    if v_match_competition is null then
      raise exception 'target_match_not_found' using errcode = 'P0002';
    end if;
    if v_match_competition <> v_competition_id then
      raise exception 'target_match_wrong_competition' using errcode = '22023';
    end if;

    if public.is_match_locked(p_target_match_id) then
      raise exception 'match_locked' using errcode = '22023';
    end if;

    -- Agrégat boussole
    select score_a, score_b, count
    into v_bs_score_a, v_bs_score_b, v_bs_count
    from public.boussole_most_common_score(v_concours_id, p_target_match_id);

    if v_bs_score_a is null then
      v_payload := jsonb_build_object('count', 0);
    else
      v_payload := jsonb_build_object(
        'score_a', v_bs_score_a,
        'score_b', v_bs_score_b,
        'count', v_bs_count
      );
    end if;

    update public.user_jokers
    set used_at = now(),
        used_on_match_id = p_target_match_id,
        used_payload = v_payload
    where id = p_user_joker_id
    returning * into v_slot;

    return v_slot;

  elsif v_code in ('challenge', 'double_down') then
    -- ------ CHALLENGE : cible un match ET un user ------
    if p_target_match_id is null then
      raise exception 'target_match_required' using errcode = '22023';
    end if;
    if p_target_user_id is null then
      raise exception 'target_user_required' using errcode = '22023';
    end if;
    if p_target_user_id = v_caller then
      raise exception 'target_is_self' using errcode = '22023';
    end if;

    -- Target user est participant du concours
    if not exists (
      select 1 from public.concours_participants
      where concours_id = v_concours_id
        and user_id = p_target_user_id
    ) then
      raise exception 'target_user_not_in_concours' using errcode = '22023';
    end if;

    select competition_id into v_match_competition
    from public.matchs where id = p_target_match_id;
    if v_match_competition is null then
      raise exception 'target_match_not_found' using errcode = 'P0002';
    end if;
    if v_match_competition <> v_competition_id then
      raise exception 'target_match_wrong_competition' using errcode = '22023';
    end if;

    if public.is_match_locked(p_target_match_id) then
      raise exception 'match_locked' using errcode = '22023';
    end if;

    -- Category stacking : max 1 challenge par (user, match)
    if exists (
      select 1
      from public.user_jokers uj
      inner join public.jokers j on j.code = uj.joker_code
      where uj.user_id = v_caller
        and uj.concours_id = v_concours_id
        and uj.used_on_match_id = p_target_match_id
        and uj.used_at is not null
        and j.category = 'challenge'
    ) then
      raise exception 'category_already_used_on_match' using errcode = '23505';
    end if;

    v_stakes := case v_code when 'challenge' then 5 when 'double_down' then 10 end;
    v_payload := jsonb_build_object('stakes', v_stakes);

    update public.user_jokers
    set used_at = now(),
        used_on_match_id = p_target_match_id,
        used_on_target_user_id = p_target_user_id,
        used_payload = v_payload
    where id = p_user_joker_id
    returning * into v_slot;

    return v_slot;

  elsif v_code = 'gift' then
    -- ------ SOCIAL : gift à un user du même concours ------
    if p_target_match_id is not null then
      raise exception 'target_match_forbidden' using errcode = '22023';
    end if;
    if p_target_user_id is null then
      raise exception 'target_user_required' using errcode = '22023';
    end if;
    if p_target_user_id = v_caller then
      raise exception 'target_is_self' using errcode = '22023';
    end if;
    if p_payload is null or not (p_payload ? 'gifted_joker_code') then
      raise exception 'payload_missing_gifted_code' using errcode = '22023';
    end if;

    v_gifted_code := p_payload ->> 'gifted_joker_code';
    if v_gifted_code is null or v_gifted_code = '' then
      raise exception 'payload_missing_gifted_code' using errcode = '22023';
    end if;
    if v_gifted_code = 'gift' then
      raise exception 'cannot_gift_a_gift' using errcode = '22023';
    end if;

    -- Target user est participant du concours
    if not exists (
      select 1 from public.concours_participants
      where concours_id = v_concours_id
        and user_id = p_target_user_id
    ) then
      raise exception 'target_user_not_in_concours' using errcode = '22023';
    end if;

    -- Caller possède un slot du joker donné (différent du slot gift).
    -- FOR UPDATE pour éviter qu'un autre appel consomme ce slot
    -- entre le SELECT et l'UPDATE ci-dessous.
    select * into v_gifted_slot
    from public.user_jokers
    where user_id = v_caller
      and concours_id = v_concours_id
      and joker_code = v_gifted_code
      and used_at is null
      and id <> p_user_joker_id
    order by acquired_at asc
    limit 1
    for update;

    if not found then
      raise exception 'gifted_joker_not_owned' using errcode = '22023';
    end if;

    -- Crée le slot receveur AVANT de consommer, pour stocker l'id
    -- dans le payload des slots donneurs.
    insert into public.user_jokers (
      user_id, concours_id, joker_code, acquired_from
    ) values (
      p_target_user_id, v_concours_id, v_gifted_code, 'gift'
    )
    returning * into v_new_target_slot;

    -- Consomme le slot gift (celui pointé par p_user_joker_id)
    update public.user_jokers
    set used_at = now(),
        used_on_target_user_id = p_target_user_id,
        used_payload = jsonb_build_object(
          'gifted_joker_code', v_gifted_code,
          'gifted_slot_id', v_gifted_slot.id,
          'created_slot_id', v_new_target_slot.id
        )
    where id = p_user_joker_id
    returning * into v_slot;

    -- Consomme le slot offert
    update public.user_jokers
    set used_at = now(),
        used_on_target_user_id = p_target_user_id,
        used_payload = jsonb_build_object(
          'via_gift_slot_id', p_user_joker_id,
          'created_slot_id', v_new_target_slot.id
        )
    where id = v_gifted_slot.id;

    return v_slot;

  else
    raise exception 'unknown_joker_code' using errcode = '22023';
  end if;
end;
$$;

comment on function public.use_joker(uuid, uuid, uuid, jsonb) is
  'RPC transactionnel de consommation d''un joker. SECURITY DEFINER + check auth.uid() = user_jokers.user_id. Dispatch par joker_code avec validations spécifiques (cible, verrouillage temporel, category stacking). Retourne le slot consommé.';

revoke all on function public.use_joker(uuid, uuid, uuid, jsonb) from public;
grant execute on function public.use_joker(uuid, uuid, uuid, jsonb) to authenticated;

-- ---------- 5. Grants helpers ----------

revoke all on function public.boussole_most_common_score(uuid, uuid) from public;
grant execute on function public.boussole_most_common_score(uuid, uuid) to authenticated;

grant execute on function public.joker_category(text) to authenticated;
