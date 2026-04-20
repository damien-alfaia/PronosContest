import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

import type { CompetitionUpsertInput } from './schemas';

/**
 * Couche API admin pour le référentiel des compétitions.
 *
 * Lecture :
 *   - `listCompetitionsAdmin` : toutes les compétitions, triées par
 *     date de début décroissante (les plus récentes en haut). Sur le
 *     front "joueur" on a déjà `listCompetitions` côté concours ; on
 *     garde cette fonction distincte pour indépendance de tri + usage
 *     mutation.
 *
 * Mutations (protégées par RLS + `is_admin()`) :
 *   - `createCompetition`
 *   - `updateCompetition`
 *   - `deleteCompetition` (échoue via FK RESTRICT si utilisée).
 *
 * Erreurs Supabase potentielles :
 *   - 42501 (RLS) : non-admin → bloqué en amont par `RequireAdmin`,
 *     mais la RLS reste source de vérité.
 *   - 23505 (UNIQUE) : `competitions.code` unique → mappé en UI.
 *   - 23503 (FK RESTRICT) : suppression refusée car `concours` ou
 *     `matchs` référencent encore la compétition.
 *   - 23514 (CHECK) : dates incohérentes / sport / status hors enum.
 */

export type Competition = Database['public']['Tables']['competitions']['Row'];
export type CompetitionInsert =
  Database['public']['Tables']['competitions']['Insert'];
export type CompetitionUpdate =
  Database['public']['Tables']['competitions']['Update'];

// ------------------------------------------------------------------
//  LECTURE
// ------------------------------------------------------------------

/**
 * Liste toutes les compétitions pour l'admin.
 * Tri par `date_debut desc` (avec nulls en bas), puis `nom asc`.
 */
export const listCompetitionsAdmin = async (): Promise<Competition[]> => {
  const { data, error } = await supabase
    .from('competitions')
    .select('*')
    .order('date_debut', { ascending: false, nullsFirst: false })
    .order('nom', { ascending: true });

  if (error) throw error;
  return data ?? [];
};

// ------------------------------------------------------------------
//  MUTATIONS
// ------------------------------------------------------------------

/**
 * Crée une compétition. Le schéma applicatif a déjà validé les bornes ;
 * la RLS + les CHECK SQL jouent leur rôle de filet de sécurité.
 */
export const createCompetition = async (
  input: CompetitionUpsertInput,
): Promise<Competition> => {
  const payload: CompetitionInsert = {
    code: input.code,
    nom: input.nom,
    sport: input.sport,
    status: input.status,
    date_debut: input.date_debut,
    date_fin: input.date_fin,
    logo_url: input.logo_url,
  };

  const { data, error } = await supabase
    .from('competitions')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

/**
 * Met à jour une compétition. Le `code` reste modifiable tant qu'il
 * respecte l'unicité globale.
 */
export const updateCompetition = async (params: {
  id: string;
  input: CompetitionUpsertInput;
}): Promise<Competition> => {
  const { id, input } = params;
  const patch: CompetitionUpdate = {
    code: input.code,
    nom: input.nom,
    sport: input.sport,
    status: input.status,
    date_debut: input.date_debut,
    date_fin: input.date_fin,
    logo_url: input.logo_url,
  };

  const { data, error } = await supabase
    .from('competitions')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

/**
 * Supprime une compétition. Erreur 23503 si elle a encore des matchs
 * ou des concours rattachés (FK RESTRICT) → on la renvoie au caller
 * qui la mappe sur un toast explicite côté UI.
 */
export const deleteCompetition = async (id: string): Promise<void> => {
  const { error } = await supabase.from('competitions').delete().eq('id', id);
  if (error) throw error;
};
