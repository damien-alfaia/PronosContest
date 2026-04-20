import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

import type {
  AssignMatchTeamsInput,
  UpdateMatchResultInput,
  UpdateMatchStatusInput,
} from './schemas';

/**
 * Couche API admin pour les matchs.
 *
 * Toutes les mutations sont protégées côté BDD par la RLS admin
 * (policies `matchs_insert_admin` / `matchs_update_admin` /
 * `matchs_delete_admin` + helper `is_admin()`). Côté UI on a aussi
 * le guard `RequireAdmin`, donc l'utilisateur non admin n'arrive
 * jamais ici — mais la RLS reste la source de vérité.
 */

export type Match = Database['public']['Tables']['matchs']['Row'];
export type MatchUpdate = Database['public']['Tables']['matchs']['Update'];
export type Equipe = Database['public']['Tables']['equipes']['Row'];

/**
 * Match enrichi pour l'admin : les équipes peuvent être null tant qu'un
 * placeholder KO n'a pas été rempli, donc les relations sont nullable.
 */
export type AdminMatchRow = Match & {
  equipe_a:
    | Pick<Equipe, 'id' | 'code' | 'nom' | 'groupe' | 'drapeau_url'>
    | null;
  equipe_b:
    | Pick<Equipe, 'id' | 'code' | 'nom' | 'groupe' | 'drapeau_url'>
    | null;
};

const EQUIPE_SELECT = 'id, code, nom, groupe, drapeau_url' as const;

// `matchs` a 2 FK vers `equipes` (equipe_a_id / equipe_b_id) : on nomme
// explicitement la contrainte pour désambiguïser les relations.
const ADMIN_MATCH_SELECT = `
  *,
  equipe_a:equipes!matchs_equipe_a_id_fkey (${EQUIPE_SELECT}),
  equipe_b:equipes!matchs_equipe_b_id_fkey (${EQUIPE_SELECT})
` as const;

// ------------------------------------------------------------------
//  LECTURE
// ------------------------------------------------------------------

/**
 * Liste tous les matchs d'une compétition pour l'admin, triés par
 * coup d'envoi croissant. Contrairement à `listMatchsByCompetition`
 * côté pronos, on renvoie les matchs **sans équipes** aussi
 * (placeholders KO) — l'admin a besoin de les voir pour les remplir.
 */
export const listAdminMatchsByCompetition = async (
  competitionId: string,
): Promise<AdminMatchRow[]> => {
  const { data, error } = await supabase
    .from('matchs')
    .select(ADMIN_MATCH_SELECT)
    .eq('competition_id', competitionId)
    .order('kick_off_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as AdminMatchRow[];
};

/**
 * Liste toutes les équipes d'une compétition (triées par groupe puis nom).
 * Utilisé par les selects d'assignation.
 */
export const listEquipesForCompetition = async (
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

/**
 * Met à jour les équipes d'un match (placeholder KO → qualifiés).
 *
 * Erreurs Supabase potentielles :
 *   - 42501 (RLS) : non-admin (ne devrait pas arriver avec le guard).
 *   - 23514 (CHECK) : soit `matchs_equipes_distinct` (même équipe des
 *     deux côtés), soit levé par le trigger
 *     `matchs_prevent_team_change_if_finished` si le match est fini.
 *   - 23503 (FK) : equipe_id inexistante ou appartenant à une autre
 *     compétition.
 */
export const updateMatchTeams = async (
  input: AssignMatchTeamsInput,
): Promise<Match> => {
  const patch: MatchUpdate = {
    equipe_a_id: input.equipe_a_id,
    equipe_b_id: input.equipe_b_id,
  };

  const { data, error } = await supabase
    .from('matchs')
    .update(patch)
    .eq('id', input.match_id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

/**
 * Saisie / correction du résultat d'un match.
 *
 * On écrit :
 *   - `score_a` / `score_b` (temps réglementaire + prolongations)
 *   - `vainqueur_tab` : 'a' / 'b' / null selon KO + égalité
 *   - `penalty_score_a` / `_b` : affichage des TAB
 *   - `status` : 'live' ou 'finished'
 *
 * La vue `v_pronos_points` ne considère un prono comme "final" que si
 * `status = 'finished'` ET `score_a`/`score_b` sont renseignés.
 * Passer à 'live' affiche le score en direct sans déclencher le scoring.
 */
export const updateMatchResult = async (
  input: UpdateMatchResultInput,
): Promise<Match> => {
  const patch: MatchUpdate = {
    score_a: input.score_a,
    score_b: input.score_b,
    vainqueur_tab: input.vainqueur_tab,
    penalty_score_a: input.penalty_score_a,
    penalty_score_b: input.penalty_score_b,
    status: input.status,
  };

  const { data, error } = await supabase
    .from('matchs')
    .update(patch)
    .eq('id', input.match_id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

/**
 * Changement de statut isolé (report / annulation / remise en scheduled).
 * Ne touche pas aux scores.
 */
export const updateMatchStatus = async (
  input: UpdateMatchStatusInput,
): Promise<Match> => {
  const { data, error } = await supabase
    .from('matchs')
    .update({ status: input.status })
    .eq('id', input.match_id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

/**
 * Remise à zéro d'un résultat (admin s'est trompé et veut "déverrouiller"
 * le scoring avant refaire la saisie). Repasse `status` à 'scheduled',
 * efface les scores et les pénos.
 *
 * À utiliser avec précaution : si des pronos ont déjà été scorés sur ce
 * match, leur contribution disparaît du classement jusqu'à la
 * prochaine saisie.
 */
export const resetMatchResult = async (matchId: string): Promise<Match> => {
  const patch: MatchUpdate = {
    score_a: null,
    score_b: null,
    vainqueur_tab: null,
    penalty_score_a: null,
    penalty_score_b: null,
    status: 'scheduled',
  };

  const { data, error } = await supabase
    .from('matchs')
    .update(patch)
    .eq('id', matchId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};
