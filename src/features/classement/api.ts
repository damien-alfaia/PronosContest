import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

import {
  type ClassementRow,
  type PronoPointsRow,
  normalizeClassementRow,
  normalizePronoPointsRow,
} from './schemas';

/**
 * Couche API de la feature classement.
 *
 * - Les lignes viennent de 2 vues Postgres (`security_invoker = on`) :
 *     - `v_classement_concours` : agrégation par (concours, user) + RANK
 *     - `v_pronos_points`       : détail par prono / match
 *
 * - RLS :
 *     - `v_classement_concours` hérite de `concours_participants` + `profiles`
 *       (policies `profiles_select_same_concours` + policies de cp).
 *     - `v_pronos_points` hérite de `pronos` (self uniquement tant que
 *       le match n'est pas verrouillé ; visible après kick-off pour les
 *       autres membres). Comme seuls les matchs `finished` produisent
 *       des points et qu'un match `finished` est forcément locked, le
 *       classement reste complet et correct.
 *
 * - Toutes les colonnes des vues remontent `nullable` dans les types
 *   générés (artefact de Supabase) : on passe donc par des normalizers
 *   Zod (`schemas.ts`) pour produire des types stricts côté front.
 */

export type RawClassementRow =
  Database['public']['Views']['v_classement_concours']['Row'];
export type RawPronoPointsRow =
  Database['public']['Views']['v_pronos_points']['Row'];

// ------------------------------------------------------------------
//  CLASSEMENT — agrégé par concours
// ------------------------------------------------------------------

/**
 * Récupère le classement d'un concours, trié par rang ascendant.
 *
 * Le tri est déjà garanti côté SQL (RANK() order by points desc,
 * pronos_exacts desc, pronos_gagnes desc) mais on re-order ici pour
 * que l'UI reste correcte même si un jour la vue changeait.
 *
 * Les lignes invalides (hors contrat Zod) sont ignorées silencieusement
 * — elles correspondraient à une corruption de la vue qu'on ne veut pas
 * voir planter le front.
 */
export const listClassement = async (
  concoursId: string,
): Promise<ClassementRow[]> => {
  const { data, error } = await supabase
    .from('v_classement_concours')
    .select('*')
    .eq('concours_id', concoursId)
    .order('rang', { ascending: true })
    .order('points', { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .map(normalizeClassementRow)
    .filter((row): row is ClassementRow => row !== null);
};

// ------------------------------------------------------------------
//  PRONOS POINTS — détail par match
// ------------------------------------------------------------------

/**
 * Détail des points gagnés par un user dans un concours, match par match.
 *
 * RLS : un user ne voit que ses propres pronos non-lockés. Pour voir
 * ceux d'un autre user, il faut que le match soit verrouillé (et il
 * l'est toujours quand il est `finished`). En pratique :
 *   - `userId = auth.uid()` → récupère tout, locked ou pas,
 *   - `userId` différent → récupère uniquement les matchs lockés.
 *
 * On filtre aussi sur `is_final = true` pour ne rapatrier que les matchs
 * qui ont produit des points. Les pronos sur matchs scheduled / live
 * ont `is_final = false` et points_base = 0 : inutile de les charger.
 */
export const listPronosPointsForUser = async (
  concoursId: string,
  userId: string,
): Promise<PronoPointsRow[]> => {
  const { data, error } = await supabase
    .from('v_pronos_points')
    .select('*')
    .eq('concours_id', concoursId)
    .eq('user_id', userId)
    .eq('is_final', true);

  if (error) throw error;

  return (data ?? [])
    .map(normalizePronoPointsRow)
    .filter((row): row is PronoPointsRow => row !== null);
};

/**
 * Variante "tous les users d'un concours" — servira à une future vue
 * comparative (tableau match × user). Mêmes règles RLS : on ne voit
 * les autres que sur les matchs finis / lockés.
 */
export const listAllPronosPointsInConcours = async (
  concoursId: string,
): Promise<PronoPointsRow[]> => {
  const { data, error } = await supabase
    .from('v_pronos_points')
    .select('*')
    .eq('concours_id', concoursId)
    .eq('is_final', true);

  if (error) throw error;

  return (data ?? [])
    .map(normalizePronoPointsRow)
    .filter((row): row is PronoPointsRow => row !== null);
};
