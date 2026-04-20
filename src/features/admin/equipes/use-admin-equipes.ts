import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminMatchsKeys } from '@/features/admin/matchs/use-admin-matchs';
import { equipesKeys } from '@/features/concours/use-concours';

import {
  type Equipe,
  createEquipe,
  deleteEquipe,
  listEquipesAdmin,
  updateEquipe,
} from './api';
import type { EquipeUpsertInput } from './schemas';

/**
 * Hooks TanStack Query pour l'admin référentiel — équipes.
 *
 * Convention de queryKey :
 *   ['admin', 'equipes', 'list', competitionId]
 *
 * Stratégie d'invalidation après mutation :
 *   - `adminEquipesKeys.byCompetition(id)` (liste admin de la compét)
 *   - `equipesKeys.byCompetition(id)`      (lecteur concours)
 *   - `adminMatchsKeys.equipesByCompetition(id)` (select d'assignation
 *      matchs → teams dialog)
 *   - `adminMatchsKeys.byCompetition(id)`  (la page admin matchs joint
 *     les équipes dans chaque ligne, donc renommage = refetch)
 */

// ------------------------------------------------------------------
//  KEYS
// ------------------------------------------------------------------

export const adminEquipesKeys = {
  all: ['admin', 'equipes'] as const,
  byCompetition: (competitionId: string | undefined) =>
    ['admin', 'equipes', 'list', competitionId ?? 'none'] as const,
};

// ------------------------------------------------------------------
//  QUERIES
// ------------------------------------------------------------------

export const useAdminEquipesQuery = (competitionId: string | undefined) =>
  useQuery<Equipe[]>({
    queryKey: adminEquipesKeys.byCompetition(competitionId),
    queryFn: () => listEquipesAdmin(competitionId as string),
    enabled: Boolean(competitionId),
    staleTime: 30_000,
  });

// ------------------------------------------------------------------
//  INVALIDATION COMMUNE
// ------------------------------------------------------------------

const invalidateAfterEquipeMutation = (
  queryClient: ReturnType<typeof useQueryClient>,
  competitionId: string | undefined,
): void => {
  void queryClient.invalidateQueries({
    queryKey: adminEquipesKeys.byCompetition(competitionId),
  });
  void queryClient.invalidateQueries({
    queryKey: equipesKeys.byCompetition(competitionId),
  });
  void queryClient.invalidateQueries({
    queryKey: adminMatchsKeys.equipesByCompetition(competitionId),
  });
  void queryClient.invalidateQueries({
    queryKey: adminMatchsKeys.byCompetition(competitionId),
  });
};

// ------------------------------------------------------------------
//  MUTATIONS
// ------------------------------------------------------------------

export const useCreateEquipeMutation = (
  competitionId: string | undefined,
) => {
  const queryClient = useQueryClient();
  return useMutation<Equipe, Error, EquipeUpsertInput>({
    mutationFn: createEquipe,
    onSuccess: () => invalidateAfterEquipeMutation(queryClient, competitionId),
  });
};

export const useUpdateEquipeMutation = (
  competitionId: string | undefined,
) => {
  const queryClient = useQueryClient();
  return useMutation<Equipe, Error, { id: string; input: EquipeUpsertInput }>({
    mutationFn: updateEquipe,
    onSuccess: () => invalidateAfterEquipeMutation(queryClient, competitionId),
  });
};

export const useDeleteEquipeMutation = (
  competitionId: string | undefined,
) => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteEquipe,
    onSuccess: () => invalidateAfterEquipeMutation(queryClient, competitionId),
  });
};
