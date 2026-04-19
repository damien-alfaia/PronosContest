import { supabase } from '@/lib/supabase';
import type { Database, Json } from '@/types/database';

import type { ConcoursCreateInput } from './schemas';

/**
 * Couche API de la feature concours.
 *
 * - Aucune RPC privilégiée : tout passe par la RLS (voir migration
 *   `20260419130000_init_concours.sql`) sauf `join_concours_by_code`
 *   qui est une RPC SECURITY DEFINER.
 * - Types issus de `Database['public']['Tables']` pour rester en phase
 *   avec les migrations (regen via `supabase gen types ...`).
 */

export type Concours = Database['public']['Tables']['concours']['Row'];
export type ConcoursInsert = Database['public']['Tables']['concours']['Insert'];
export type Competition = Database['public']['Tables']['competitions']['Row'];
export type Equipe = Database['public']['Tables']['equipes']['Row'];
export type ConcoursParticipant =
  Database['public']['Tables']['concours_participants']['Row'];

/**
 * Concours + infos compétition (lecture).
 * Supabase retourne `competition` en nested object car la FK est connue.
 */
export type ConcoursWithCompetition = Concours & {
  competition: Pick<
    Competition,
    'id' | 'code' | 'nom' | 'sport' | 'date_debut' | 'date_fin' | 'status' | 'logo_url'
  > | null;
};

export type ConcoursDetail = ConcoursWithCompetition & {
  participants: Pick<ConcoursParticipant, 'user_id' | 'role' | 'joined_at'>[];
};

// ------------------------------------------------------------------
//  LIST / GET
// ------------------------------------------------------------------

/**
 * Concours où l'utilisateur courant est participant (via RLS).
 * NB : la RLS SELECT autorise `public OR owner OR participant`.
 * Pour "mes concours", on passe par `concours_participants` pour être
 * sûr d'exclure les publics où je ne suis pas inscrit.
 */
export const listMyConcours = async (
  userId: string,
): Promise<ConcoursWithCompetition[]> => {
  const { data, error } = await supabase
    .from('concours_participants')
    .select(
      `
        joined_at,
        role,
        concours:concours_id (
          *,
          competition:competition_id (
            id, code, nom, sport, date_debut, date_fin, status, logo_url
          )
        )
      `,
    )
    .eq('user_id', userId)
    .order('joined_at', { ascending: false });

  if (error) throw error;

  // On "applatit" { joined_at, role, concours } -> concours
  // en filtrant les lignes sans concours (cas improbable : FK cascade).
  const rows = (data ?? [])
    .map((row) => row.concours)
    .filter((c): c is ConcoursWithCompetition => c !== null);

  return rows;
};

/**
 * Concours publics (listés). Recherche optionnelle sur `nom` ilike.
 */
export const listPublicConcours = async (
  search?: string,
): Promise<ConcoursWithCompetition[]> => {
  let query = supabase
    .from('concours')
    .select(
      `
        *,
        competition:competition_id (
          id, code, nom, sport, date_debut, date_fin, status, logo_url
        )
      `,
    )
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(50);

  const trimmed = search?.trim();
  if (trimmed && trimmed.length > 0) {
    // ilike = case-insensitive. On échappe les wildcards utilisateurs
    // pour ne pas qu'un `%` saisi devienne un wildcard SQL.
    const escaped = trimmed.replace(/[%_]/g, (c) => `\\${c}`);
    query = query.ilike('nom', `%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ConcoursWithCompetition[];
};

/**
 * Détail d'un concours avec ses participants.
 * RLS : lecture autorisée si public / owner / participant.
 */
export const getConcoursById = async (id: string): Promise<ConcoursDetail | null> => {
  const { data, error } = await supabase
    .from('concours')
    .select(
      `
        *,
        competition:competition_id (
          id, code, nom, sport, date_debut, date_fin, status, logo_url
        ),
        participants:concours_participants (
          user_id, role, joined_at
        )
      `,
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as ConcoursDetail | null;
};

// ------------------------------------------------------------------
//  MUTATIONS
// ------------------------------------------------------------------

/**
 * Crée un concours. Le trigger SQL :
 *  - génère `code_invitation` si visibility != 'public'
 *  - ajoute l'owner dans `concours_participants` en tant qu'admin
 */
export const createConcours = async (
  ownerId: string,
  input: ConcoursCreateInput,
): Promise<Concours> => {
  const insertPayload: ConcoursInsert = {
    owner_id: ownerId,
    nom: input.nom,
    description: input.description ?? null,
    competition_id: input.competition_id,
    visibility: input.visibility,
    // scoring_rules est jsonb côté Postgres, donc `Json` côté client.
    scoring_rules: input.scoring_rules as unknown as Json,
  };

  const { data, error } = await supabase
    .from('concours')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

/**
 * Rejoint un concours public (self-insert autorisé par RLS).
 * L'insertion est idempotente grâce à la PK (concours_id, user_id)
 * — on ignore l'erreur 23505 (unique violation).
 */
export const joinPublicConcours = async (
  concoursId: string,
  userId: string,
): Promise<void> => {
  const { error } = await supabase.from('concours_participants').insert({
    concours_id: concoursId,
    user_id: userId,
    role: 'member',
  });

  if (error && error.code !== '23505') throw error;
};

/**
 * Quitte un concours (self-delete autorisé par RLS).
 */
export const leaveConcours = async (
  concoursId: string,
  userId: string,
): Promise<void> => {
  const { error } = await supabase
    .from('concours_participants')
    .delete()
    .eq('concours_id', concoursId)
    .eq('user_id', userId);

  if (error) throw error;
};

/**
 * Rejoint un concours privé / unlisted via son code d'invitation.
 * Retourne l'id du concours rejoint.
 *
 * Les erreurs métier remontent comme PostgrestError avec message :
 *  - 'code_required'
 *  - 'concours_not_found'
 *  - 'concours_not_joinable'
 */
export const joinConcoursByCode = async (code: string): Promise<string> => {
  const { data, error } = await supabase.rpc('join_concours_by_code', {
    p_code: code,
  });

  if (error) throw error;
  if (!data) throw new Error('concours_not_found');
  return data;
};

// ------------------------------------------------------------------
//  COMPÉTITIONS (lecture)
// ------------------------------------------------------------------

/**
 * Liste les compétitions disponibles (pour le select de création).
 * RLS : lecture ouverte aux authentifiés.
 */
export const listCompetitions = async (): Promise<Competition[]> => {
  const { data, error } = await supabase
    .from('competitions')
    .select('*')
    .order('date_debut', { ascending: true });

  if (error) throw error;
  return data ?? [];
};

/**
 * Équipes d'une compétition (utilisé par le futur sprint pronos,
 * exposé ici pour les détails de concours).
 */
export const listEquipesByCompetition = async (
  competitionId: string,
): Promise<Equipe[]> => {
  const { data, error } = await supabase
    .from('equipes')
    .select('*')
    .eq('competition_id', competitionId)
    .order('groupe', { ascending: true })
    .order('nom', { ascending: true });

  if (error) throw error;
  return data ?? [];
};
