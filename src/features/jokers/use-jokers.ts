import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';

import {
  type ConcoursParticipantForPicker,
  type ConsumeJokerArgs,
  type IncomingChallengeRow,
  type UserJokerHistoryRow,
  consumeJoker,
  countUserOwnedJokersInConcours,
  getBoussoleMostCommonScore,
  listConcoursParticipantsForPicker,
  listIncomingChallengesInConcours,
  listJokersCatalog,
  listUserJokersHistory,
  listUserJokersInConcours,
  setConcoursJokersEnabled,
} from './api';
import {
  type BoussoleResult,
  type JokerCatalogRow,
  type UserJokerRow,
  type UserJokerWithCatalog,
} from './schemas';

/**
 * Hooks TanStack Query + Realtime pour les jokers (Sprint 8.A).
 *
 * Convention de queryKey :
 *   ['jokers', 'catalog']
 *   ['jokers', 'user', userId, concoursId]
 *   ['jokers', 'user', userId, concoursId, 'count']
 *
 * Stratégie Realtime :
 *   - La publication `supabase_realtime` inclut `user_jokers` (ajout
 *     dans la migration Sprint 8.A).
 *   - Les triggers SQL (participant_insert, badge_earned, concours_enable)
 *     attribuent les jokers en arrière-plan : un INSERT dans user_jokers
 *     déclenche l'invalidation côté front.
 *   - On filtre sur `user_id=eq.${userId}` + concours_id pour ne recevoir
 *     que les events pertinents. La RLS filtre déjà côté serveur.
 *
 * Pas de Realtime sur le catalogue : immuable à l'échelle d'une session
 * (seed uniquement, modifié via migration).
 *
 * Pour le toggle `jokers_enabled` (owner), l'invalidation de la query
 * `['concours', 'detail', id]` (Sprint 2) est faite via `onSuccess` —
 * on ne touche pas à la queryKey jokers, puisque c'est le trigger SQL
 * qui va pousser les user_jokers via Realtime.
 */

// ------------------------------------------------------------------
//  KEYS
// ------------------------------------------------------------------

export const jokersKeys = {
  all: ['jokers'] as const,
  catalog: () => ['jokers', 'catalog'] as const,
  userAll: (userId: string | undefined, concoursId: string | undefined) =>
    ['jokers', 'user', userId ?? 'none', concoursId ?? 'none'] as const,
  userCount: (userId: string | undefined, concoursId: string | undefined) =>
    [
      'jokers',
      'user',
      userId ?? 'none',
      concoursId ?? 'none',
      'count',
    ] as const,
  userHistory: (userId: string | undefined) =>
    ['jokers', 'user', userId ?? 'none', 'history'] as const,
  participants: (concoursId: string | undefined) =>
    ['jokers', 'participants', concoursId ?? 'none'] as const,
  boussole: (concoursId: string | undefined, matchId: string | undefined) =>
    [
      'jokers',
      'boussole',
      concoursId ?? 'none',
      matchId ?? 'none',
    ] as const,
  incomingChallenges: (
    concoursId: string | undefined,
    userId: string | undefined,
  ) =>
    [
      'jokers',
      'incomingChallenges',
      concoursId ?? 'none',
      userId ?? 'none',
    ] as const,
};

// ------------------------------------------------------------------
//  QUERIES
// ------------------------------------------------------------------

/**
 * Catalogue complet (7 jokers seedés). `staleTime: 1h` : lecture
 * publique, modifié uniquement via migration, pas la peine de refetch
 * à chaque montage.
 */
export const useJokersCatalogQuery = () =>
  useQuery<JokerCatalogRow[]>({
    queryKey: jokersKeys.catalog(),
    queryFn: listJokersCatalog,
    staleTime: 60 * 60 * 1000, // 1h
  });

/**
 * Jokers d'un user dans un concours (jointurés avec le catalogue).
 * `staleTime: 30s` : suffisant pour la section "Mes jokers" qu'on ne
 * refresh pas frénétiquement, complété par l'invalidation Realtime.
 */
export const useUserJokersInConcoursQuery = (
  userId: string | undefined,
  concoursId: string | undefined,
) =>
  useQuery<UserJokerWithCatalog[]>({
    queryKey: jokersKeys.userAll(userId, concoursId),
    queryFn: () =>
      listUserJokersInConcours(userId as string, concoursId as string),
    enabled: Boolean(userId) && Boolean(concoursId),
    staleTime: 30_000,
  });

/**
 * Compteur de jokers "owned" (non-utilisés) d'un user dans un concours.
 * Pour widgets / badges de la section jokers.
 */
export const useUserOwnedJokersCountQuery = (
  userId: string | undefined,
  concoursId: string | undefined,
) =>
  useQuery<number>({
    queryKey: jokersKeys.userCount(userId, concoursId),
    queryFn: () =>
      countUserOwnedJokersInConcours(userId as string, concoursId as string),
    enabled: Boolean(userId) && Boolean(concoursId),
    staleTime: 30_000,
  });

/**
 * Historique cross-concours des jokers d'un user (owned + used toutes
 * compétitions confondues). Utilisé par la `HistoriqueJokersSection`
 * sur la page profil — vue d'ensemble qui survit à la suppression
 * d'un concours (via `ON DELETE CASCADE` côté SQL).
 *
 * Pas de Realtime dédié : les mutations de consommation (`useConsumeJokerMutation`)
 * invalident déjà `jokersKeys.all` qui englobe cette clé. Les attributions
 * par trigger (starter pack / badge / gift reçu) sont propagées par le
 * Realtime `user_jokers` déjà monté côté concours courant ; pour la page
 * profil, un `staleTime: 30s` est suffisant (on ne reste pas des heures
 * sur cette page).
 */
export const useUserJokersHistoryQuery = (userId: string | undefined) =>
  useQuery<UserJokerHistoryRow[]>({
    queryKey: jokersKeys.userHistory(userId),
    queryFn: () => listUserJokersHistory(userId as string),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

/**
 * Résultat de la boussole pour un (concours, match) — agrégat anonymisé
 * du score majoritaire. À activer uniquement quand l'utilisateur a déjà
 * consommé un joker `boussole` sur ce match (sinon on révèle rien).
 *
 * `staleTime: 60s` : la boussole est un "snapshot" — on tolère qu'elle
 * ne soit pas strictement temps réel, le Realtime sur `pronos` invalide
 * déjà la grille de pronos à chaque nouveau prono saisi, ce qui refetch
 * la boussole à la prochaine navigation.
 */
export const useBoussoleScoreQuery = (
  concoursId: string | undefined,
  matchId: string | undefined,
  options: { enabled?: boolean } = {},
) =>
  useQuery<BoussoleResult>({
    queryKey: jokersKeys.boussole(concoursId, matchId),
    queryFn: () =>
      getBoussoleMostCommonScore(concoursId as string, matchId as string),
    enabled:
      Boolean(concoursId) && Boolean(matchId) && (options.enabled ?? true),
    staleTime: 60_000,
  });

/**
 * Liste les jokers `challenge` / `double_down` qu'un autre participant
 * a lancés contre l'utilisateur courant sur un concours — utilisé par
 * `MatchJokersBadges` pour afficher "Tu es défié par X" au-dessus des
 * scores dans la grille de pronos.
 *
 * `staleTime: 30s` + invalidation via `useConsumeJokerMutation`
 * (clé `jokersKeys.all`) → quand un adversaire nous challenge, la liste
 * est rafraîchie à la prochaine interaction. Le Realtime sur
 * `user_jokers` filtre sur `user_id=eq.me` et ne couvre donc PAS les
 * challenges reçus ; on garde un refetch opportuniste via staleTime.
 */
export const useIncomingChallengesInConcoursQuery = (
  concoursId: string | undefined,
  userId: string | undefined,
  options: { enabled?: boolean } = {},
) =>
  useQuery<IncomingChallengeRow[]>({
    queryKey: jokersKeys.incomingChallenges(concoursId, userId),
    queryFn: () =>
      listIncomingChallengesInConcours(concoursId as string, userId as string),
    enabled:
      Boolean(concoursId) && Boolean(userId) && (options.enabled ?? true),
    staleTime: 30_000,
  });

/**
 * Participants d'un concours (avec nom/prenom/avatar) pour les pickers
 * "cible" des jokers challenge / gift. Filtrage "exclure soi-même"
 * fait côté composant.
 *
 * `staleTime` court (30s) : la liste bouge rarement mais on veut
 * refléter un nouvel arrivant sans forcer un refresh manuel.
 */
export const useConcoursParticipantsForPickerQuery = (
  concoursId: string | undefined,
  options: { enabled?: boolean } = {},
) =>
  useQuery<ConcoursParticipantForPicker[]>({
    queryKey: jokersKeys.participants(concoursId),
    queryFn: () => listConcoursParticipantsForPicker(concoursId as string),
    enabled: Boolean(concoursId) && (options.enabled ?? true),
    staleTime: 30_000,
  });

// ------------------------------------------------------------------
//  MUTATIONS
// ------------------------------------------------------------------

/**
 * Toggle `concours.jokers_enabled` (owner only via RLS).
 *
 * Invalide la query de détail du concours (pour que la UI reflète
 * le flag à jour) + les listes de jokers du user courant sur ce
 * concours (le trigger SQL va y écrire les starters dès le passage
 * false → true). Le Realtime fera le reste pour les autres users.
 */
export const useSetConcoursJokersEnabledMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      concoursId,
      enabled,
    }: {
      concoursId: string;
      enabled: boolean;
    }) => setConcoursJokersEnabled(concoursId, enabled),

    onSuccess: (_data, variables) => {
      // Fiche concours : reflect the jokers_enabled flag
      void queryClient.invalidateQueries({
        queryKey: ['concours', 'detail', variables.concoursId],
      });
      // Au cas où d'autres listes (mes concours, publics) affichent le flag
      void queryClient.invalidateQueries({
        queryKey: ['concours'],
      });
      // Les listes de jokers utilisateur vont être rafraîchies via Realtime
      // sur user_jokers, mais on invalide par sécurité pour les users
      // autres que celui qui a toggle (ex : l'owner n'est pas encore
      // participant — cas rare).
      void queryClient.invalidateQueries({
        queryKey: jokersKeys.all,
      });
    },
  });
};

/**
 * Consomme un joker via la RPC `use_joker` (Sprint 8.B.1).
 *
 * Le caller passe :
 *   - `userJokerId` : UUID du slot à consommer.
 *   - `targetMatchId` / `targetUserId` / `payload` : selon le code du
 *     joker (cf. `consumeJoker` dans api.ts).
 *
 * Invalidations onSuccess :
 *   1. `jokersKeys.all` — mes jokers (slot passe à "used"), + participants
 *      potentiellement impactés (gift crée un slot chez le target).
 *   2. `['classement', concoursId]` — les effets scoring (double/triple/
 *      safety_net/challenge/double_down) changent le classement agrégé.
 *      Realtime sur `matchs` / `pronos` (Sprint 4) ne couvre PAS les
 *      écritures sur `user_jokers` → on invalide manuellement.
 *   3. `['pronos', concoursId, 'me']` — boussole révèle un agrégat que
 *      la UI peut surfacer dans la grille de pronos (non couvert par
 *      Realtime pronos non plus).
 *
 * NB : on n'a pas besoin du `concoursId` en argument — on le récupère
 * depuis la ligne retournée par la RPC (concours_id est dans
 * `user_jokers`). Ça évite au caller de le passer deux fois.
 */
export const useConsumeJokerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<UserJokerRow, Error, ConsumeJokerArgs>({
    mutationFn: (args) => consumeJoker(args),

    onSuccess: (data) => {
      // 1. Tous les listings jokers (le slot est passé à "used" ; en cas
      // de gift, un nouveau slot est créé chez la cible → catch-all).
      void queryClient.invalidateQueries({ queryKey: jokersKeys.all });

      // 2. Classement du concours (effets scoring jokers).
      void queryClient.invalidateQueries({
        queryKey: ['classement', data.concours_id],
      });

      // 3. Mes pronos (boussole révèle un agrégat que la UI peut afficher).
      void queryClient.invalidateQueries({
        queryKey: ['pronos', data.concours_id, 'me'],
      });
    },
  });
};

// ------------------------------------------------------------------
//  REALTIME
// ------------------------------------------------------------------

/**
 * Abonne le composant aux INSERT / UPDATE / DELETE sur `user_jokers`
 * pour l'user + concours demandés. Invalide les queries liste + count
 * à chaque event.
 *
 * Les filtres Realtime Supabase ne supportent qu'une condition simple
 * (`col=eq.val`), on filtre donc sur `user_id` côté serveur, et on
 * affine par `concours_id` côté client (la payload `new`/`old`
 * contient le concours_id).
 *
 * Cycle de vie : channel unique par (userId, concoursId), nettoyé
 * au démontage ou au changement de clés.
 */
export const useUserJokersRealtime = (
  userId: string | undefined,
  concoursId: string | undefined,
  options: { enabled?: boolean } = {},
): void => {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !userId || !concoursId) return;

    const invalidate = () => {
      void queryClient.invalidateQueries({
        queryKey: jokersKeys.userAll(userId, concoursId),
      });
      void queryClient.invalidateQueries({
        queryKey: jokersKeys.userCount(userId, concoursId),
      });
    };

    const channel = supabase
      .channel(`user-jokers:${userId}:${concoursId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_jokers',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // Affine par concours_id côté client.
          const row = (payload.new ?? payload.old) as
            | { concours_id?: string }
            | undefined;
          if (row?.concours_id === concoursId) {
            invalidate();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, concoursId, enabled, queryClient]);
};
