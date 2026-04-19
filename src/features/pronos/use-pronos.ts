import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type MatchWithEquipes,
  type Prono,
  deleteProno,
  listMatchsByCompetition,
  listMyPronosInConcours,
  listPronosForMatchInConcours,
  upsertProno,
} from './api';
import type { DeletePronoInput, UpsertPronoInput } from './schemas';

/**
 * Hooks TanStack Query pour la feature pronos.
 *
 * Convention de queryKey :
 *   ['matchs', competitionId]
 *   ['pronos', concoursId, 'me']
 *   ['pronos', concoursId, 'match', matchId]
 *
 * Optimistic update sur upsert :
 *   - On met à jour immédiatement la liste de mes pronos.
 *   - En cas d'erreur (RLS, FK, etc.) on rollback via le snapshot
 *     pris dans `onMutate`.
 */

// ------------------------------------------------------------------
//  KEYS
// ------------------------------------------------------------------

export const matchsKeys = {
  all: ['matchs'] as const,
  byCompetition: (competitionId: string | undefined) =>
    ['matchs', competitionId ?? 'none'] as const,
};

export const pronosKeys = {
  all: ['pronos'] as const,
  myInConcours: (concoursId: string | undefined) =>
    ['pronos', concoursId ?? 'none', 'me'] as const,
  forMatchInConcours: (
    concoursId: string | undefined,
    matchId: string | undefined,
  ) => ['pronos', concoursId ?? 'none', 'match', matchId ?? 'none'] as const,
};

// ------------------------------------------------------------------
//  QUERIES
// ------------------------------------------------------------------

/** Matchs d'une compétition (72 en phase de groupes WC 2026). */
export const useMatchsQuery = (competitionId: string | undefined) =>
  useQuery<MatchWithEquipes[]>({
    queryKey: matchsKeys.byCompetition(competitionId),
    queryFn: () => listMatchsByCompetition(competitionId as string),
    enabled: Boolean(competitionId),
    // Les matchs changent peu (seed initial + ajustements admin).
    staleTime: 5 * 60_000,
  });

/** Mes pronos pour un concours. */
export const useMyPronosInConcoursQuery = (concoursId: string | undefined) =>
  useQuery<Prono[]>({
    queryKey: pronosKeys.myInConcours(concoursId),
    queryFn: () => listMyPronosInConcours(concoursId as string),
    enabled: Boolean(concoursId),
    staleTime: 30_000,
  });

/**
 * Pronos visibles pour un match dans un concours (RLS filtre selon
 * is_match_locked). À utiliser après le coup d'envoi.
 */
export const usePronosForMatchInConcoursQuery = (
  concoursId: string | undefined,
  matchId: string | undefined,
) =>
  useQuery<Prono[]>({
    queryKey: pronosKeys.forMatchInConcours(concoursId, matchId),
    queryFn: () =>
      listPronosForMatchInConcours(concoursId as string, matchId as string),
    enabled: Boolean(concoursId && matchId),
    staleTime: 10_000,
  });

// ------------------------------------------------------------------
//  MUTATIONS
// ------------------------------------------------------------------

/**
 * Upsert d'un prono avec optimistic update.
 *
 * onMutate :
 *  1. Cancel les fetchs en cours sur la queryKey "mes pronos".
 *  2. Snapshot de la liste actuelle (pour rollback éventuel).
 *  3. Patch optimiste : insère/remplace le prono ciblé.
 *
 * onError : rollback au snapshot.
 * onSettled : invalidate la queryKey pour resync avec la BDD
 *   (utile si l'updated_at / created_at remontent par le serveur).
 */
export const useUpsertPronoMutation = (
  userId: string | undefined,
  concoursId: string | undefined,
) => {
  const queryClient = useQueryClient();
  const myKey = pronosKeys.myInConcours(concoursId);

  return useMutation<
    Prono,
    Error,
    UpsertPronoInput,
    { previous: Prono[] | undefined }
  >({
    mutationFn: (input) => {
      if (!userId) throw new Error('No user id');
      return upsertProno(userId, input);
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: myKey });
      const previous = queryClient.getQueryData<Prono[]>(myKey);

      const now = new Date().toISOString();
      queryClient.setQueryData<Prono[]>(myKey, (old) => {
        const list = old ?? [];
        const idx = list.findIndex((p) => p.match_id === input.match_id);
        const optimistic: Prono = {
          concours_id: input.concours_id,
          user_id: userId ?? '',
          match_id: input.match_id,
          score_a: input.score_a,
          score_b: input.score_b,
          vainqueur_tab: input.vainqueur_tab,
          // On garde l'ancien created_at si existant, sinon on met `now`.
          created_at: idx >= 0 ? (list[idx]?.created_at ?? now) : now,
          updated_at: now,
        };
        if (idx >= 0) {
          const next = list.slice();
          next[idx] = optimistic;
          return next;
        }
        return [...list, optimistic];
      });

      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(myKey, ctx.previous);
      }
    },
    onSettled: (_data, _err, input) => {
      void queryClient.invalidateQueries({ queryKey: myKey });
      // Invalide aussi la liste "tous les pronos visibles pour ce match"
      // au cas où on viendrait de saisir après le kick-off.
      void queryClient.invalidateQueries({
        queryKey: pronosKeys.forMatchInConcours(concoursId, input.match_id),
      });
    },
  });
};

/**
 * Suppression d'un prono avec optimistic update.
 */
export const useDeletePronoMutation = (
  userId: string | undefined,
  concoursId: string | undefined,
) => {
  const queryClient = useQueryClient();
  const myKey = pronosKeys.myInConcours(concoursId);

  return useMutation<
    void,
    Error,
    DeletePronoInput,
    { previous: Prono[] | undefined }
  >({
    mutationFn: (input) => {
      if (!userId) throw new Error('No user id');
      return deleteProno(userId, input);
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: myKey });
      const previous = queryClient.getQueryData<Prono[]>(myKey);

      queryClient.setQueryData<Prono[]>(myKey, (old) =>
        (old ?? []).filter((p) => p.match_id !== input.match_id),
      );

      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(myKey, ctx.previous);
      }
    },
    onSettled: (_data, _err, input) => {
      void queryClient.invalidateQueries({ queryKey: myKey });
      void queryClient.invalidateQueries({
        queryKey: pronosKeys.forMatchInConcours(concoursId, input.match_id),
      });
    },
  });
};
