import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

import type { EquipeUpsertInput } from './schemas';

/**
 * Couche API admin pour le référentiel des équipes.
 *
 * Lecture :
 *   - `listEquipesAdmin` : équipes d'une compétition, triées par
 *     groupe (nulls en bas) puis par nom.
 *
 * Mutations (protégées par RLS + `is_admin()`) :
 *   - `createEquipe` — insert simple.
 *   - `updateEquipe` — patch sans changer `competition_id` (verrouillé
 *     par le trigger `equipes_prevent_competition_change`).
 *   - `deleteEquipe` — échoue via FK RESTRICT si référencée par un match.
 *
 * Erreurs Supabase potentielles :
 *   - 42501 (RLS) : non-admin.
 *   - 23505 (UNIQUE) : `equipes_code_per_competition` — code déjà pris
 *     dans la même compétition → UI mappe sur un toast dédié.
 *   - 23503 (FK RESTRICT) : suppression refusée car référencée par
 *     `matchs.equipe_a_id` ou `equipe_b_id`.
 *   - 23514 (CHECK custom) : tentative de changer `competition_id`.
 */

export type Equipe = Database['public']['Tables']['equipes']['Row'];
export type EquipeInsert = Database['public']['Tables']['equipes']['Insert'];
export type EquipeUpdate = Database['public']['Tables']['equipes']['Update'];

// ------------------------------------------------------------------
//  LECTURE
// ------------------------------------------------------------------

/**
 * Liste les équipes d'une compétition, tri groupe asc (nulls en bas)
 * puis nom asc.
 */
export const listEquipesAdmin = async (
  competitionId: string,
): Promise<Equipe[]> => {
  const { data, error } = await supabase
    .from('equipes')
    .select('*')
    .eq('competition_id', competitionId)
    .order('groupe', { ascending: true, nullsFirst: false })
    .order('nom', { ascending: true });

  if (error) throw error;
  return data ?? [];
};

// ------------------------------------------------------------------
//  MUTATIONS
// ------------------------------------------------------------------

export const createEquipe = async (
  input: EquipeUpsertInput,
): Promise<Equipe> => {
  const payload: EquipeInsert = {
    competition_id: input.competition_id,
    code: input.code,
    nom: input.nom,
    groupe: input.groupe,
    drapeau_url: input.drapeau_url,
    fifa_id: input.fifa_id,
  };

  const { data, error } = await supabase
    .from('equipes')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

/**
 * Met à jour une équipe. On **n'envoie pas** `competition_id` côté
 * patch : même si le client le modifiait, le trigger SQL
 * `equipes_prevent_competition_change` lèverait une 23514. On garde
 * la cohérence côté client en omettant ce champ.
 */
export const updateEquipe = async (params: {
  id: string;
  input: EquipeUpsertInput;
}): Promise<Equipe> => {
  const { id, input } = params;
  const patch: EquipeUpdate = {
    code: input.code,
    nom: input.nom,
    groupe: input.groupe,
    drapeau_url: input.drapeau_url,
    fifa_id: input.fifa_id,
  };

  const { data, error } = await supabase
    .from('equipes')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

export const deleteEquipe = async (id: string): Promise<void> => {
  const { error } = await supabase.from('equipes').delete().eq('id', id);
  if (error) throw error;
};
