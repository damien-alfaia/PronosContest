import { supabase } from '@/lib/supabase';

import {
  type BoussoleResult,
  type JokerCatalogRow,
  type UserJokerRow,
  type UserJokerWithCatalog,
  boussoleResultSchema,
  normalizeJokerCatalogRow,
  normalizeUserJokerRow,
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
//  HISTORIQUE USER (cross-concours, pour la page profil)
// ------------------------------------------------------------------

/**
 * Ligne d'historique : `user_jokers` + catalogue `jokers` + nom du
 * concours parent. Sert à la section "Historique jokers" sur la page
 * profil (Sprint 8.C.3), qui affiche TOUS les slots d'un user toutes
 * concours confondues, triés par activité la plus récente.
 */
export type UserJokerHistoryRow = UserJokerWithCatalog & {
  concours: {
    id: string;
    nom: string;
  };
};

/**
 * Liste TOUS les slots `user_jokers` d'un user, jointés avec le catalogue
 * `jokers` ET avec le concours parent (pour afficher le nom).
 *
 * RLS :
 *   - `user_jokers_select_self_or_same_concours` autorise lecture self.
 *   - `concours` — la policy `concours_select_participant_or_public`
 *     (Sprint 2) laisse passer toute ligne où l'user est participant,
 *     ce qui est toujours le cas ici (pour avoir un user_joker il faut
 *     avoir été participant d'un concours).
 *
 * Tri server-side :
 *   - `used_at desc nulls last` : les slots utilisés récemment en premier,
 *     puis les slots actifs (used_at null).
 *   - `acquired_at desc` : tie-break dans chaque bucket.
 *
 * Le tri client-side final (`compareUserJokerByLastActivity`) réassemble
 * une timeline par activité la plus récente (max(used_at, acquired_at))
 * pour que la UI reste cohérente quel que soit l'état d'un slot.
 */
export const listUserJokersHistory = async (
  userId: string,
): Promise<UserJokerHistoryRow[]> => {
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
        ),
        concours:concours (
          id,
          nom
        )
      `,
    )
    .eq('user_id', userId)
    .order('used_at', { ascending: false, nullsFirst: false })
    .order('acquired_at', { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const base = normalizeUserJokerWithCatalog(row);
      if (!base) return null;

      // Supabase peut retourner le nested concours comme objet ou array
      // selon la cardinalité détectée : on unwrap défensivement.
      const concoursEmbed = Array.isArray(row.concours)
        ? row.concours[0]
        : row.concours;
      if (!concoursEmbed?.id || !concoursEmbed?.nom) return null;

      return {
        ...base,
        concours: {
          id: concoursEmbed.id,
          nom: concoursEmbed.nom,
        },
      } satisfies UserJokerHistoryRow;
    })
    .filter((row): row is UserJokerHistoryRow => row !== null);
};

// ------------------------------------------------------------------
//  CHALLENGES REÇUS (pour les badges MatchCard)
// ------------------------------------------------------------------

/**
 * Ligne jointe `user_jokers × jokers × profiles` pour l'affichage des
 * challenges reçus dans la MatchCard. Le `user_id` est celui du CALLER
 * du joker (pas du target !) — autrement dit, qui nous a défié.
 */
export type IncomingChallengeRow = {
  id: string;
  joker_code: string;
  joker_category: string;
  used_on_match_id: string;
  used_at: string;
  used_payload: Record<string, unknown> | null;
  from_user_id: string;
  from_prenom: string | null;
  from_nom: string | null;
  from_avatar_url: string | null;
};

/**
 * Liste les jokers `challenge` / `double_down` qu'on a reçus (qu'un
 * autre participant a lancés contre nous) sur un concours, rangés par
 * match.
 *
 * RLS : la policy `user_jokers_select_self_or_same_concours` autorise
 * la lecture cross-user dès qu'on est dans le même concours — donc
 * l'auth de `auth.uid()` suffit, pas besoin de `SECURITY DEFINER`.
 *
 * Filtre côté client sur `joker.category === 'challenge'` après
 * normalisation du catalog embed : Supabase n'expose pas `joker.category`
 * comme filtre natif sur le join.
 */
export const listIncomingChallengesInConcours = async (
  concoursId: string,
  userId: string,
): Promise<IncomingChallengeRow[]> => {
  const { data, error } = await supabase
    .from('user_jokers')
    .select(
      `
        id,
        user_id,
        used_on_match_id,
        used_at,
        used_payload,
        joker_code,
        joker:jokers (
          code,
          category
        ),
        profile:profiles!user_jokers_user_id_fkey (
          id,
          prenom,
          nom,
          avatar_url
        )
      `,
    )
    .eq('concours_id', concoursId)
    .eq('used_on_target_user_id', userId)
    .not('used_at', 'is', null)
    .not('used_on_match_id', 'is', null);

  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      if (
        !row.id ||
        !row.user_id ||
        !row.used_on_match_id ||
        !row.used_at ||
        !row.joker_code
      ) {
        return null;
      }
      const jokerEmbed = Array.isArray(row.joker) ? row.joker[0] : row.joker;
      const category = jokerEmbed?.category;
      if (category !== 'challenge') return null;

      const profileEmbed = Array.isArray(row.profile)
        ? row.profile[0]
        : row.profile;

      const payload: Record<string, unknown> | null =
        typeof row.used_payload === 'object' &&
        row.used_payload !== null &&
        !Array.isArray(row.used_payload)
          ? (row.used_payload as Record<string, unknown>)
          : null;

      return {
        id: row.id,
        joker_code: row.joker_code,
        joker_category: category,
        used_on_match_id: row.used_on_match_id,
        used_at: row.used_at,
        used_payload: payload,
        from_user_id: row.user_id,
        from_prenom: profileEmbed?.prenom ?? null,
        from_nom: profileEmbed?.nom ?? null,
        from_avatar_url: profileEmbed?.avatar_url ?? null,
      } satisfies IncomingChallengeRow;
    })
    .filter((r): r is IncomingChallengeRow => r !== null);
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

// ------------------------------------------------------------------
//  CONSOMMATION (RPC use_joker — Sprint 8.B)
// ------------------------------------------------------------------

/**
 * Codes d'erreur Postgres remontés par le RPC `use_joker` (cf.
 * migration `20260427120000_jokers_consumption.sql`). On les ré-expose
 * côté front pour que la UI mappe chaque code à un libellé i18n.
 *
 * `postgres-js` remonte l'erreur avec `message` = le string après
 * `raise exception '...'`. On teste donc `message.includes(code)` dans
 * les composants plutôt que `code` (sql-state) qui est plus générique.
 */
export const JOKER_CONSUMPTION_ERROR_CODES = [
  'not_authenticated',
  'joker_not_found',
  'not_owner',
  'already_used',
  'concours_not_found',
  'jokers_disabled',
  'target_match_required',
  'target_match_forbidden',
  'target_user_required',
  'target_user_forbidden',
  'target_user_not_in_concours',
  'target_match_not_found',
  'target_match_wrong_competition',
  'target_is_self',
  'match_locked',
  'category_already_used_on_match',
  'payload_missing_gifted_code',
  'cannot_gift_a_gift',
  'gifted_joker_not_owned',
  'unknown_joker_code',
] as const;
export type JokerConsumptionErrorCode =
  (typeof JOKER_CONSUMPTION_ERROR_CODES)[number];

/**
 * Paramètres RPC pour `use_joker`. Le backend dispatche sur
 * `user_joker.joker_code` — chaque code impose sa propre combinaison
 * de cibles (cf. table de mapping dans la migration 8.B.1).
 */
export type ConsumeJokerArgs = {
  /** UUID du slot `user_jokers` à consommer (owned, self). */
  userJokerId: string;
  /** Match ciblé — requis pour boost / info / challenge, interdit pour gift. */
  targetMatchId?: string | null;
  /** User ciblé — requis pour challenge / gift, interdit pour boost / info. */
  targetUserId?: string | null;
  /** Payload contextuel — boussole : auto-généré côté SQL ; gift : { gifted_joker_code }. */
  payload?: Record<string, unknown> | null;
};

/**
 * Consomme un joker via la RPC `use_joker` (SECURITY DEFINER côté SQL).
 * Le backend valide l'ownership, le verrouillage temporel, le category
 * stacking et la cohérence des cibles. En cas de succès, retourne la
 * ligne `user_jokers` mise à jour (used_at / used_on_* renseignés).
 *
 * Les erreurs remontent sous la forme d'un `Error` avec message issu
 * de `raise exception '<code>'` côté SQL — la UI fait un `includes()`
 * pour mapper vers un libellé i18n.
 */
export const consumeJoker = async (
  args: ConsumeJokerArgs,
): Promise<UserJokerRow> => {
  const { data, error } = await supabase.rpc('use_joker', {
    p_user_joker_id: args.userJokerId,
    p_target_match_id: args.targetMatchId ?? undefined,
    p_target_user_id: args.targetUserId ?? undefined,
    p_payload: args.payload ?? undefined,
  });

  if (error) throw error;

  // `data` est typé `unknown` tant que `supabase gen types` n'a pas
  // régénéré la signature de la RPC — on normalise via Zod pour
  // récupérer une ligne strictement typée côté front.
  const row = data as {
    id: string | null;
    user_id: string | null;
    concours_id: string | null;
    joker_code: string | null;
    acquired_from: string | null;
    acquired_at: string | null;
    used_at: string | null;
    used_on_match_id: string | null;
    used_on_target_user_id: string | null;
    used_payload: unknown;
  };

  const normalized = normalizeUserJokerRow(row);
  if (!normalized) {
    throw new Error('use_joker_invalid_response');
  }
  return normalized;
};

// ------------------------------------------------------------------
//  BOUSSOLE (RPC boussole_most_common_score — Sprint 8.C)
// ------------------------------------------------------------------

/**
 * Récupère l'agrégat anonymisé du score majoritaire parmi les pronos
 * d'un concours sur un match donné (helper `SECURITY DEFINER` côté SQL).
 *
 * Utilisé par le badge "Boussole" dans la MatchCard : après consommation
 * d'un joker `boussole`, on affiche le score le plus fréquent + le
 * nombre de pronos qui le partagent — jamais la liste individuelle, ce
 * qui garantit la RLS `pronos` (lecture verrouillée avant kick-off).
 *
 * Retourne `null` si la RPC retourne `null` (pas de prono sur le match)
 * ou si la payload ne respecte pas le schéma — défensif pour éviter de
 * faire planter la UI sur une réponse inattendue.
 */
export const getBoussoleMostCommonScore = async (
  concoursId: string,
  matchId: string,
): Promise<BoussoleResult> => {
  const { data, error } = await supabase.rpc('boussole_most_common_score', {
    p_concours_id: concoursId,
    p_match_id: matchId,
  });

  if (error) throw error;

  const parsed = boussoleResultSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
};

// ------------------------------------------------------------------
//  PARTICIPANTS DU CONCOURS (pour les pickers challenge / gift)
// ------------------------------------------------------------------

/**
 * Ligne jointe `concours_participants × profiles` minimale pour les
 * pickers de cible (challenge, gift). On ne remonte que les colonnes
 * utilisées côté UI (nom d'affichage + avatar).
 */
export type ConcoursParticipantForPicker = {
  user_id: string;
  role: string | null;
  joined_at: string;
  prenom: string | null;
  nom: string | null;
  avatar_url: string | null;
};

/**
 * Liste les participants d'un concours avec leur profil (prenom / nom /
 * avatar) pour alimenter les pickers "cible" des jokers challenge et
 * gift.
 *
 * La RLS de `concours_participants` + policy `profiles_select_same_concours`
 * garantissent déjà que le caller ne voit que les participants des
 * concours auxquels il appartient (Sprint 4).
 *
 * Tri : nouveaux arrivants en premier (`joined_at desc`) — utile pour
 * retrouver rapidement un nouvel arrivant qu'on veut challenger/gifter,
 * et fallback stable (join desc = ordre d'apparition inverse).
 */
export const listConcoursParticipantsForPicker = async (
  concoursId: string,
): Promise<ConcoursParticipantForPicker[]> => {
  const { data, error } = await supabase
    .from('concours_participants')
    .select(
      `
        user_id,
        role,
        joined_at,
        profile:profiles (
          id,
          prenom,
          nom,
          avatar_url
        )
      `,
    )
    .eq('concours_id', concoursId)
    .order('joined_at', { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      if (!row.user_id) return null;
      // Supabase retourne le nested profile comme objet (FK 1-1) mais
      // certains types générés le sérialisent en tableau → unwrap
      // défensivement.
      const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
      return {
        user_id: row.user_id,
        role: row.role ?? null,
        joined_at: row.joined_at,
        prenom: profile?.prenom ?? null,
        nom: profile?.nom ?? null,
        avatar_url: profile?.avatar_url ?? null,
      } satisfies ConcoursParticipantForPicker;
    })
    .filter((r): r is ConcoursParticipantForPicker => r !== null);
};
