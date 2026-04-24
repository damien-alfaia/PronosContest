import { z } from 'zod';

import { supabase } from '@/lib/supabase';

/**
 * API landing — agrégats publics affichés sur la page d'accueil
 * (bloc "social proof").
 *
 * La source unique de vérité est la fonction Postgres
 * `public.get_landing_stats()` (SECURITY DEFINER, accessible anon).
 * Elle retourne un jsonb `{ nb_concours, nb_pronos, nb_users }`.
 *
 * Le schéma Zod ci-dessous valide le retour côté front et filtre
 * toute ligne mal formée (si la fonction retourne `null` ou un objet
 * incomplet, on renvoie des zéros plutôt que casser la landing).
 */

const landingStatsSchema = z.object({
  nb_concours: z.number().int().nonnegative(),
  nb_pronos: z.number().int().nonnegative(),
  nb_users: z.number().int().nonnegative(),
});

export type LandingStats = {
  nbConcours: number;
  nbPronos: number;
  nbUsers: number;
};

export const LANDING_STATS_ZERO: LandingStats = {
  nbConcours: 0,
  nbPronos: 0,
  nbUsers: 0,
};

export async function getLandingStats(): Promise<LandingStats> {
  const { data, error } = await supabase.rpc('get_landing_stats');
  if (error) throw error;

  const parsed = landingStatsSchema.safeParse(data);
  if (!parsed.success) {
    // Fallback silencieux : on ne bloque pas la landing sur un payload
    // malformé. Les logs serveur captureront le vrai incident.
    return LANDING_STATS_ZERO;
  }

  return {
    nbConcours: parsed.data.nb_concours,
    nbPronos: parsed.data.nb_pronos,
    nbUsers: parsed.data.nb_users,
  };
}
