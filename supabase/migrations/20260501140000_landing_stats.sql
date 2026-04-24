-- =============================================================
--  Sprint 9 — Semaine 1 : statistiques publiques pour la landing
-- =============================================================
--
--  Objectif : exposer aux visiteurs anonymes (avant signup) trois
--  chiffres agrégés pour le bloc "social proof" de la landing :
--    - nb_concours : nombre total de concours créés
--    - nb_pronos   : nombre total de pronostics saisis
--    - nb_users    : nombre total d'utilisateurs inscrits
--
--  Choix d'implémentation : function SECURITY DEFINER plutôt qu'une
--  vue ou un RPC lourd. Raisons :
--    1. Les tables concours / pronos / profiles ont des RLS strictes
--       qui bloqueraient un SELECT anon. Une function SECURITY DEFINER
--       permet d'exposer UNIQUEMENT les agrégats (aucune PII, aucune
--       ligne unitaire) avec un contrat clair.
--    2. Plus simple qu'une vue matérialisée à rafraîchir par cron.
--       Les count() sur ces 3 tables restent rapides à l'échelle d'un
--       lancement CdM (quelques milliers de users max avant qu'on
--       doive envisager une matérialisation).
--    3. La function est STABLE : même appel, même résultat dans une
--       même transaction. Supabase/PostgREST peut cacher aggressive-
--       ment côté client (staleTime 5 min dans TanStack Query).
--
--  Anti-sandbagging : si un jour les tables explosent en volume, on
--  migre vers une vue matérialisée + cron nocturne sans changer
--  l'interface publique (même signature, même retour JSON).
--
-- =============================================================

create or replace function public.get_landing_stats()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'nb_concours', (select count(*) from public.concours),
    'nb_pronos',   (select count(*) from public.pronos),
    'nb_users',    (select count(*) from public.profiles)
  );
$$;

comment on function public.get_landing_stats() is
  'Agrégats publics pour le social proof de la landing. Anon-accessible.';

-- Exposer à anon et authenticated (la landing est visible avant login)
grant execute on function public.get_landing_stats() to anon, authenticated;

-- =============================================================
--  Note : aucune vue n'est créée ici. Si le volume impose plus tard
--  une vue matérialisée, on la créera en `security_invoker=off` avec
--  un GRANT SELECT à anon, et on remplacera le corps de
--  get_landing_stats() par un SELECT sur la vue — sans casser
--  l'interface PostgREST côté client.
-- =============================================================
