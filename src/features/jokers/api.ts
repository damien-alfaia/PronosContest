import { supabase } from '@/lib/supabase';

import {
  type JokerCatalogRow,
  type UserJokerWithCatalog,
  normalizeJokerCatalogRow,
  normalizeUserJokerWithCatalog,
} from './schemas';

/**
 * Couche API de la feature jokers (Sprint 8.A).
 *
 * Deux sources :
 *   - `jokers` : catalogue immuable, lecture ouverte à tous les
 *     authentifiés (policy `jokers_select_all`).
 *   - `user_jokers` : lecture self OU même concours (policy
 *     `user_jokers_select_self_or_same_concours`).
 *
 * Les mutations d'acquisition passent exclusivement par les triggers
 * `SECURITY DEFINER` côté SQL (voir migration 20260426120000) — donc
 * aucune écriture directe sur `user_jokers` depuis le front. L'usage
 * (`used_at`, ...) sera piloté par la RPC `use_joker` en Sprint 8.B.
 *
 * Seule mutation côté front ici : `setConcoursJokersEnabled`
 * (toggle `jokers_enabled` sur un concours, réservé à l'owner via RLS
 * `concours_update_owner_or_admin`). L'activation déclenche le trigger
 * SQL `jokers_on_concours_enable` qui rétro-distribue le starter pack
 * et backfill les badges.
 */

// ------------------------------------------------------------------
//  CATALOGUE
// ------------------------------------------------------------------

/**
 * Récupère les 7 jokers du catalogue, triés par `sort_order` (ordre
 * de seed contrôlé côté SQL : boost → info → challenge → social).
 *
 * Volume fixe et lecture publique : bon candidat pour un `staleTime`
 * long côté hook (1h). Si le seed bouge, `supabase db reset` +
 * refresh client suffisent.
 */
export const listJokersCatalog = async (): Promise<JokerCatalogRow[]> => {
  const { data, error } = await supabase
    .from('jokers')
    .select('code, category, libelle, description, icon, sort_order')
    .order('sort_order', { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .map(normalizeJokerCatalogRow)
    .filter((row): row is JokerCatalogRow => row !== null);
};

// ------------------------------------------------------------------
//  USER JOKERS
// ------------------------------------------------------------------

/**
 * Récupère les jokers d'un user dans un concours donné, jointurés
 * avec le catalogue (libellé / icône / description).
 *
 * Tri :
 *   - `used_at asc` puis `acquired_at desc` côté SQL : c'est un
 *     premier tri "owned d'abord" (null trié en premier en ASC). Le
 *     tri final (`compareUserJokerForInventory`) est appliqué par
 *     les composants qui ont besoin de la vue catalogue groupée.
 *
 * Les lignes dont le join est invalide (joker supprimé du catalogue,
 * seed cassé…) sont filtrées silencieusement pour ne pas faire
 * planter la section "Mes jokers" sur un détail.
 */
export const listUserJokersInConcours = async (
  userId: string,
  concoursId: string,
): Promise<UserJokerWithCatalog[]> => {
  const { data, error } = await supabase
    .from('user_jokers')
    .select(
      `
        id,
        user_id,
        concours_id,
        joker_code,
        acquired_from,
        acquired_at,
        used_at,
        used_on_match_id,
        used_on_target_user_id,
        used_payload,
        joker:jokers (
          code,
          category,
          libelle,
          description,
          icon,
          sort_order
        )
      `,
    )
    .eq('user_id', userId)
    .eq('concours_id', concoursId)
    .order('used_at', { ascending: true, nullsFirst: true })
    .order('acquired_at', { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .map(normalizeUserJokerWithCatalog)
    .filter((row): row is UserJokerWithCatalog => row !== null);
};

/**
 * Compte les slots "owned" (non-utilisés) d'un user dans un concours.
 *
 * Sert aux compteurs (section "Mes jokers", futurs badges/widgets)
 * sans rapatrier tout le détail. `head: true` + `count: 'exact'` :
 * Supabase ne retourne pas les lignes, juste le total.
 */
export const countUserOwnedJokersInConcours = async (
  userId: string,
  concoursId: string,
): Promise<number> => {
  const { count, error } = await supabase
    .from('user_jokers')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('concours_id', concoursId)
    .is('used_at', null);

  if (error) throw error;
  return count ?? 0;
};

// ------------------------------------------------------------------
//  CONCOURS TOGGLE (owner only via RLS)
// ------------------------------------------------------------------

/**
 * Active / désactive le système de jokers sur un concours.
 * Réservé à l'owner par la RLS existante de `concours` (policy
 * `concours_update_owner_or_admin`) — on ne recode pas de check
 * côté front, la RLS lève une 42501 si l'appelant n'est pas autorisé.
 *
 * Effet de bord côté SQL (trigger `jokers_on_concours_enable`) :
 *   - Transition `false → true` : distribue le starter pack et
 *     backfill les badges unlocks à tous les participants déjà
 *     inscrits.
 *   - Transition `true → false` : aucune propagation (les jokers
 *     déjà attribués restent attribués — on ne "reprend" rien à
 *     chaud pour éviter la perte de possessions en cas de toggle
 *     accidentel).
 */
export const setConcoursJokersEnabled = async (
  concoursId: string,
  enabled: boolean,
): Promise<void> => {
  const { error } = await supabase
    .from('concours')
    .update({ jokers_enabled: enabled })
    .eq('id', concoursId);

  if (error) throw error;
};
