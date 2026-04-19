import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

import type { DeletePronoInput, UpsertPronoInput } from './schemas';

/**
 * Couche API de la feature pronos.
 *
 * - Lecture des matchs via la RLS (SELECT ouvert aux authentifiés).
 * - Lecture des pronos filtrée par RLS :
 *     - mes propres pronos sont toujours visibles,
 *     - ceux des autres uniquement après le coup d'envoi
 *       (`is_match_locked(match_id)`).
 * - Mutations sur pronos : self-only + match non verrouillé
 *   (RLS bloque tout reste).
 */

export type Match = Database['public']['Tables']['matchs']['Row'];
export type Prono = Database['public']['Tables']['pronos']['Row'];
export type PronoInsert = Database['public']['Tables']['pronos']['Insert'];
export type Equipe = Database['public']['Tables']['equipes']['Row'];

/**
 * Match enrichi avec les 2 équipes.
 * Les FK sont NOT NULL + ON DELETE RESTRICT donc jamais null côté types.
 */
export type MatchWithEquipes = Match & {
  equipe_a: Pick<Equipe, 'id' | 'code' | 'nom' | 'groupe' | 'drapeau_url'>;
  equipe_b: Pick<Equipe, 'id' | 'code' | 'nom' | 'groupe' | 'drapeau_url'>;
};

const EQUIPE_SELECT = 'id, code, nom, groupe, drapeau_url' as const;

// Désambiguïsation : `matchs` a 2 FK vers `equipes`, on cible la bonne
// contrainte pour éviter `SelectQueryError` côté types générés.
const MATCH_WITH_EQUIPES_SELECT = `
  *,
  equipe_a:equipes!matchs_equipe_a_id_fkey (${EQUIPE_SELECT}),
  equipe_b:equipes!matchs_equipe_b_id_fkey (${EQUIPE_SELECT})
` as const;

// ------------------------------------------------------------------
//  MATCHS
// ------------------------------------------------------------------

/**
 * Liste les matchs d'une compétition, ordonnés par coup d'envoi.
 * Sert d'entrée à la grille de saisie des pronos.
 */
export const listMatchsByCompetition = async (
  competitionId: string,
): Promise<MatchWithEquipes[]> => {
  const { data, error } = await supabase
    .from('matchs')
    .select(MATCH_WITH_EQUIPES_SELECT)
    .eq('competition_id', competitionId)
    .order('kick_off_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as MatchWithEquipes[];
};

// ------------------------------------------------------------------
//  PRONOS — LECTURE
// ------------------------------------------------------------------

/**
 * Mes pronos pour un concours donné.
 * RLS : `user_id = auth.uid()` autorise la lecture, donc pas besoin
 * de filtrer côté client.
 */
export const listMyPronosInConcours = async (
  concoursId: string,
): Promise<Prono[]> => {
  const { data, error } = await supabase
    .from('pronos')
    .select('*')
    .eq('concours_id', concoursId);

  if (error) throw error;
  return data ?? [];
};

/**
 * Tous les pronos visibles pour un match donné dans un concours.
 * RLS filtre :
 *   - mon prono toujours,
 *   - ceux des autres participants UNIQUEMENT si match verrouillé.
 *
 * Le front s'en sert pour afficher la liste des pronos après kick-off.
 */
export const listPronosForMatchInConcours = async (
  concoursId: string,
  matchId: string,
): Promise<Prono[]> => {
  const { data, error } = await supabase
    .from('pronos')
    .select('*')
    .eq('concours_id', concoursId)
    .eq('match_id', matchId);

  if (error) throw error;
  return data ?? [];
};

// ------------------------------------------------------------------
//  PRONOS — MUTATIONS
// ------------------------------------------------------------------

/**
 * Upsert un prono (création ou modification).
 *
 * - Le payload inclut `phase` côté form pour la validation Zod, mais
 *   on ne l'envoie pas en BDD (pas de colonne `phase` sur pronos).
 * - L'upsert se fait sur la PK composite (concours_id, user_id, match_id).
 * - `user_id` est injecté ici à partir de la session : la RLS exige
 *   que `user_id = auth.uid()`.
 *
 * Erreurs côté Supabase à anticiper :
 *   - `42501` (RLS) : pas participant du concours, ou match verrouillé.
 *   - `23503` (FK)  : match_id ou concours_id inexistant.
 *   - `23514` (CHECK) : score_a/b hors bornes (déjà bloqué côté Zod).
 */
export const upsertProno = async (
  userId: string,
  input: UpsertPronoInput,
): Promise<Prono> => {
  const payload: PronoInsert = {
    concours_id: input.concours_id,
    user_id: userId,
    match_id: input.match_id,
    score_a: input.score_a,
    score_b: input.score_b,
    vainqueur_tab: input.vainqueur_tab,
  };

  const { data, error } = await supabase
    .from('pronos')
    .upsert(payload, { onConflict: 'concours_id,user_id,match_id' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

/**
 * Supprime mon prono pour un (concours, match).
 * RLS : self-only + match non verrouillé.
 *
 * Pas d'erreur si la ligne n'existait pas (idempotent côté UI).
 */
export const deleteProno = async (
  userId: string,
  input: DeletePronoInput,
): Promise<void> => {
  const { error } = await supabase
    .from('pronos')
    .delete()
    .eq('concours_id', input.concours_id)
    .eq('user_id', userId)
    .eq('match_id', input.match_id);

  if (error) throw error;
};
