import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type ConcoursDetail,
  type ConcoursWithCompetition,
  createConcours,
  getConcoursById,
  joinConcoursByCode,
  joinPublicConcours,
  leaveConcours,
  listCompetitions,
  listEquipesByCompetition,
  listMyConcours,
  listPublicConcours,
} from './api';
import type { ConcoursCreateInput } from './schemas';

/**
 * Hooks TanStack Query pour la feature concours.
 *
 * Convention de queryKey :
 *   ['concours', 'mine', userId]
 *   ['concours', 'public', search]
 *   ['concours', 'detail', id]
 *   ['competitions', 'list']
 *   ['equipes', competitionId]
 *
 * On invalide finement via le préfixe `['concours']` quand c'est sûr.
 */

// ------------------------------------------------------------------
//  KEYS
// ------------------------------------------------------------------

export const concoursKeys = {
  all: ['concours'] as const,
  mine: (userId: string | undefined) => ['concours', 'mine', userId ?? 'anon'] as const,
  publicList: (search: string | undefined) =>
    ['concours', 'public', (search ?? '').trim().toLowerCase()] as const,
  detail: (id: string | undefined) => ['concours', 'detail', id ?? 'none'] as const,
};

export const competitionsKeys = {
  list: ['competitions', 'list'] as const,
};

export const equipesKeys = {
  byCompetition: (competitionId: string | undefined) =>
    ['equipes', competitionId ?? 'none'] as const,
};

// ------------------------------------------------------------------
//  QUERIES
// ------------------------------------------------------------------

/** Concours dont je suis membre. */
export const useMyConcoursQuery = (userId: string | undefined) =>
  useQuery<ConcoursWithCompetition[]>({
    queryKey: concoursKeys.mine(userId),
    queryFn: () => listMyConcours(userId as string),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

/** Concours publics, filtrés par search (debounced côté UI). */
export const usePublicConcoursQuery = (search: string | undefined) =>
  useQuery<ConcoursWithCompetition[]>({
    queryKey: concoursKeys.publicList(search),
    queryFn: () => listPublicConcours(search),
    staleTime: 30_000,
  });

/** Détail d'un concours. */
export const useConcoursDetailQuery = (id: string | undefined) =>
  useQuery<ConcoursDetail | null>({
    queryKey: concoursKeys.detail(id),
    queryFn: () => getConcoursById(id as string),
    enabled: Boolean(id),
    staleTime: 10_000,
  });

/** Liste des compétitions (pour select de création). */
export const useCompetitionsQuery = () =>
  useQuery({
    queryKey: competitionsKeys.list,
    queryFn: listCompetitions,
    staleTime: 5 * 60_000, // change rarement
  });

/** Équipes d'une compétition. */
export const useEquipesQuery = (competitionId: string | undefined) =>
  useQuery({
    queryKey: equipesKeys.byCompetition(competitionId),
    queryFn: () => listEquipesByCompetition(competitionId as string),
    enabled: Boolean(competitionId),
    staleTime: 5 * 60_000,
  });

// ------------------------------------------------------------------
//  MUTATIONS
// ------------------------------------------------------------------

/** Crée un concours. Invalide la liste "mine" après succès. */
export const useCreateConcoursMutation = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ConcoursCreateInput) => {
      if (!userId) throw new Error('No user id');
      return createConcours(userId, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: concoursKeys.mine(userId) });
    },
  });
};

/** Rejoint un concours public (self-insert). */
export const useJoinPublicConcoursMutation = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (concoursId: string) => {
      if (!userId) throw new Error('No user id');
      return joinPublicConcours(concoursId, userId);
    },
    onSuccess: (_data, concoursId) => {
      void queryClient.invalidateQueries({ queryKey: concoursKeys.mine(userId) });
      void queryClient.invalidateQueries({ queryKey: concoursKeys.detail(concoursId) });
    },
  });
};

/** Rejoint un concours privé/unlisted via code. Retourne l'id. */
export const useJoinByCodeMutation = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation<string, Error, string>({
    mutationFn: (code: string) => joinConcoursByCode(code),
    onSuccess: (concoursId) => {
      void queryClient.invalidateQueries({ queryKey: concoursKeys.mine(userId) });
      void queryClient.invalidateQueries({ queryKey: concoursKeys.detail(concoursId) });
    },
  });
};

/** Quitte un concours (self-delete). */
export const useLeaveConcoursMutation = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (concoursId: string) => {
      if (!userId) throw new Error('No user id');
      return leaveConcours(concoursId, userId);
    },
    onSuccess: (_data, concoursId) => {
      void queryClient.invalidateQueries({ queryKey: concoursKeys.mine(userId) });
      void queryClient.invalidateQueries({ queryKey: concoursKeys.detail(concoursId) });
    },
  });
};
