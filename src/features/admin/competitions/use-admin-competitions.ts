import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminMatchsKeys } from '@/features/admin/matchs/use-admin-matchs';
import { competitionsKeys } from '@/features/concours/use-concours';

import {
  type Competition,
  createCompetition,
  deleteCompetition,
  listCompetitionsAdmin,
  updateCompetition,
} from './api';
import type { CompetitionUpsertInput } from './schemas';

/**
 * Hooks TanStack Query pour l'admin référentiel — compétitions.
 *
 * Convention de queryKey :
 *   ['admin', 'competitions']           → liste admin
 *   (partagée côté joueur : ['competitions', 'list'])
 *
 * Stratégie d'invalidation après mutation :
 *   - `adminCompetitionsKeys.list` (liste admin elle-même)
 *   - `competitionsKeys.list`      (select de création côté concours)
 *   - `adminMatchsKeys.all`        (le sélecteur de compétition dans
 *     la page admin matchs utilise aussi cette liste).
 *
 * On ne touche pas aux caches `classement` ni `equipes` : une
 * création / rename de compétition n'impacte pas ces données.
 */

// ------------------------------------------------------------------
//  KEYS
// ------------------------------------------------------------------

export const adminCompetitionsKeys = {
  all: ['admin', 'competitions'] as const,
  list: ['admin', 'competitions', 'list'] as const,
};

// ------------------------------------------------------------------
//  QUERIES
// ------------------------------------------------------------------

export const useAdminCompetitionsQuery = () =>
  useQuery<Competition[]>({
    queryKey: adminCompetitionsKeys.list,
    queryFn: listCompetitionsAdmin,
    staleTime: 30_000,
  });

// ------------------------------------------------------------------
//  INVALIDATION COMMUNE
// ------------------------------------------------------------------

const invalidateAfterCompetitionMutation = (
  queryClient: ReturnType<typeof useQueryClient>,
): void => {
  void queryClient.invalidateQueries({ queryKey: adminCompetitionsKeys.list });
  void queryClient.invalidateQueries({ queryKey: competitionsKeys.list });
  void queryClient.invalidateQueries({ queryKey: adminMatchsKeys.all });
};

// ------------------------------------------------------------------
//  MUTATIONS
// ------------------------------------------------------------------

export const useCreateCompetitionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<Competition, Error, CompetitionUpsertInput>({
    mutationFn: createCompetition,
    onSuccess: () => invalidateAfterCompetitionMutation(queryClient),
  });
};

export const useUpdateCompetitionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<
    Competition,
    Error,
    { id: string; input: CompetitionUpsertInput }
  >({
    mutationFn: updateCompetition,
    onSuccess: () => invalidateAfterCompetitionMutation(queryClient),
  });
};

export const useDeleteCompetitionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteCompetition,
    onSuccess: () => invalidateAfterCompetitionMutation(queryClient),
  });
};
