-- =============================================================
--  Sprint 9 — Semaine 2 : triggers milestones onboarding (auto)
-- =============================================================
--
--  Les milestones `first_prono_saved_at` et `first_concours_joined_at`
--  sont déclenchés automatiquement par des triggers SECURITY DEFINER
--  attachés aux tables `pronos` et `concours_participants`. Ça évite
--  d'avoir à mettre à jour la progression depuis le front (fragile —
--  dépendrait que l'user passe par les mutations React).
--
--  `first_classement_viewed_at` et `first_invite_sent_at` restent
--  pilotés par le front : ce sont des événements UI (visite d'une
--  page / clic share) non-représentables par un INSERT DB.
--
--  Idempotence : le `UPDATE ... WHERE xxx_at IS NULL` garantit que
--  chaque milestone n'est défini qu'une seule fois. Les triggers sont
--  AFTER INSERT sans guard FOR EACH ROW supplémentaire — la row sait
--  quel user_id écrire.
-- =============================================================

-- ---------- first_prono_saved_at ----------
create or replace function public.handle_onboarding_first_prono()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_onboarding_progress
     set first_prono_saved_at = now()
   where user_id = new.user_id
     and first_prono_saved_at is null;
  return null;
end;
$$;

comment on function public.handle_onboarding_first_prono() is
  'Marque first_prono_saved_at à la première saisie de prono (idempotent).';

drop trigger if exists onboarding_first_prono on public.pronos;
create trigger onboarding_first_prono
after insert on public.pronos
for each row execute function public.handle_onboarding_first_prono();

-- ---------- first_concours_joined_at ----------
create or replace function public.handle_onboarding_first_concours()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_onboarding_progress
     set first_concours_joined_at = now()
   where user_id = new.user_id
     and first_concours_joined_at is null;
  return null;
end;
$$;

comment on function public.handle_onboarding_first_concours() is
  'Marque first_concours_joined_at à la première adhésion à un concours (idempotent).';

drop trigger if exists onboarding_first_concours on public.concours_participants;
create trigger onboarding_first_concours
after insert on public.concours_participants
for each row execute function public.handle_onboarding_first_concours();
