import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { classementKeys } from '@/features/classement/use-classement';
import { matchsKeys } from '@/features/pronos/use-pronos';

import {
  type AdminMatchRow,
  type Equipe,
  type Match,
  listAdminMatchsByCompetition,
  listEquipesForCompetition,
  resetMatchResult,
  updateMatchResult,
  updateMatchStatus,
  updateMatchTeams,
} from './api';
import type {
  AssignMatchTeamsInput,
  UpdateMatchResultInput,
  UpdateMatchStatusInput,
} from './schemas';

/**
 * Hooks TanStack Query pour l'admin matchs.
 *
 * Convention de queryKey :
 *   ['admin', 'matchs', competitionId]
 *   ['admin', 'equipes', competitionId]
 *
 * Stratégie d'invalidation :
 *   Toute mutation admin sur un match impacte :
 *     1. La liste admin elle-même (`adminMatchsKeys.byCompetition`)
 *     2. La liste "pronos" côté joueur (`matchsKeys.byCompetition`)
 *        — MatchCard relit `equipe_a_id` / `equipe_b_id` + kick_off_at.
 *     3. Le classement de chaque concours construit sur cette compétition
 *        (`classementKeys.all` = invalidation large, peu coûteuse).
 *     4. La queryKey `['classement', *, 'pronos-points']` pour le détail
 *        par user dans tous les concours ouverts.
 *
 *   On pourrait être plus fin en retrouvant les concours impactés,
 *   mais la flat invalidation sur `classementKeys.all` fait le job
 *   sans over-engineering : TanStack Query ne refetch que les queries
 *   actuellement observées (celles dont un composant monté y souscrit).
 */

// ------------------------------------------------------------------
//  KEYS
// ------------------------------------------------------------------

export const adminMatchsKeys = {
  all: ['admin', 'matchs'] as const,
  byCompetition: (competitionId: string | undefined) =>
    ['admin', 'matchs', competitionId ?? 'none'] as const,
  equipesByCompetition: (competitionId: string | undefined) =>
    ['admin', 'equipes', competitionId ?? 'none'] as const,
};

// ------------------------------------------------------------------
//  QUERIES
// ------------------------------------------------------------------

/** Liste admin complète des matchs d'une compétition. */
export const useAdminMatchsQuery = (competitionId: string | undefined) =>
  useQuery<AdminMatchRow[]>({
    queryKey: adminMatchsKeys.byCompetition(competitionId),
    queryFn: () => listAdminMatchsByCompetition(competitionId as string),
    enabled: Boolean(competitionId),
    staleTime: 30_000,
  });

/** Équipes d'une compétition (pour les selects d'assignation). */
export const useEquipesForCompetitionQuery = (
  competitionId: string | undefined,
) =>
  useQuery<Equipe[]>({
    queryKey: adminMatchsKeys.equipesByCompetition(competitionId),
    queryFn: () => listEquipesForCompetition(competitionId as string),
    enabled: Boolean(competitionId),
    staleTime: 5 * 60_000, // Les équipes bougent très peu.
  });

// ------------------------------------------------------------------
//  INVALIDATIONS COMMUNES
// ------------------------------------------------------------------

/**
 * Invalide les queries dérivées d'un match après une mutation admin.
 * Factorisé pour éviter la divergence entre les 4 mutations.
 */
const invalidateAfterMatchMutation = (
  queryClient: ReturnType<typeof useQueryClient>,
  competitionId: string | undefined,
): void => {
  // 1. La liste admin
  void queryClient.invalidateQueries({
    queryKey: adminMatchsKeys.byCompetition(competitionId),
  });
  // 2. La liste joueur (MatchCard pickups)
  void queryClient.invalidateQueries({
    queryKey: matchsKeys.byCompetition(competitionId),
  });
  // 3. Classements agrégés (tous concours ouverts sur cette compét)
  void queryClient.invalidateQueries({
    queryKey: classementKeys.all,
  });
};

// ------------------------------------------------------------------
//  MUTATIONS
// ------------------------------------------------------------------

/**
 * Assigne / change les équipes d'un match.
 * Bloqué côté trigger SQL si le match est déjà `finished`.
 */
export const useUpdateMatchTeamsMutation = (
  competitionId: string | undefined,
) => {
  const queryClient = useQueryClient();

  return useMutation<Match, Error, AssignMatchTeamsInput>({
    mutationFn: updateMatchTeams,
    onSuccess: () => {
      invalidateAfterMatchMutation(queryClient, competitionId);
    },
  });
};

/**
 * Saisit / corrige le résultat d'un match.
 * Déclenche le recalcul du scoring via `v_pronos_points` (filtrée
 * `is_final` = status finished + scores renseignés).
 */
export const useUpdateMatchResultMutation = (
  competitionId: string | undefined,
) => {
  const queryClient = useQueryClient();

  return useMutation<Match, Error, UpdateMatchResultInput>({
    mutationFn: updateMatchResult,
    onSuccess: () => {
      invalidateAfterMatchMutation(queryClient, competitionId);
    },
  });
};

/**
 * Changement de statut sec (postponed / cancelled / scheduled).
 * N'impacte pas le scoring par lui-même (ces statuts ne passent pas
 * le filtre `is_final` de `v_pronos_points`).
 */
export const useUpdateMatchStatusMutation = (
  competitionId: string | undefined,
) => {
  const queryClient = useQueryClient();

  return useMutation<Match, Error, UpdateMatchStatusInput>({
    mutationFn: updateMatchStatus,
    onSuccess: () => {
      invalidateAfterMatchMutation(queryClient, competitionId);
    },
  });
};

/**
 * Reset d'un match à 'scheduled' + scores null.
 * Utilisé pour annuler une saisie erronée.
 */
export const useResetMatchResultMutation = (
  competitionId: string | undefined,
) => {
  const queryClient = useQueryClient();

  return useMutation<Match, Error, string>({
    mutationFn: (matchId) => resetMatchResult(matchId),
    onSuccess: () => {
      invalidateAfterMatchMutation(queryClient, competitionId);
    },
  });
};
