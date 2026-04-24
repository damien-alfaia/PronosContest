import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  dismissChecklist,
  getMyOnboardingProgress,
  markFirstClassementViewed,
  markFirstConcoursJoined,
  markFirstInviteSent,
  markFirstPronoSaved,
  markTourStepCompleted,
  markWelcomed,
  restoreChecklist,
  skipTour,
} from './api';
import type { OnboardingProgressRow, TourStepId } from './schemas';
import { TOUR_STEP_IDS } from './schemas';

/**
 * Hooks TanStack Query + mutations pour l'onboarding.
 *
 * Convention de queryKey :
 *   ['onboarding', 'progress', userId]
 *
 * staleTime 30 s : les milestones bougent peu, la checklist s'ajuste
 * via invalidations ciblées après chaque mutation.
 *
 * Pas de Realtime dédié ici : les milestones sont définis côté front
 * au moment même où l'action se produit (saisie d'un prono, join d'un
 * concours). L'invalidation locale suffit.
 */

// ------------------------------------------------------------------
//  KEYS
// ------------------------------------------------------------------

export const onboardingKeys = {
  all: ['onboarding'] as const,
  progress: (userId: string | undefined) =>
    ['onboarding', 'progress', userId ?? 'none'] as const,
};

// ------------------------------------------------------------------
//  QUERY
// ------------------------------------------------------------------

export const useOnboardingProgressQuery = (userId: string | undefined) =>
  useQuery<OnboardingProgressRow | null>({
    queryKey: onboardingKeys.progress(userId),
    queryFn: () => getMyOnboardingProgress(userId as string),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

// ------------------------------------------------------------------
//  MUTATIONS — milestones
// ------------------------------------------------------------------

/**
 * Factory générique pour les 5 hooks de milestones. Chaque hook
 * expose la même API : `mutateAsync(userId)`, `isPending`, etc.
 *
 * Invalide la query de progression à la fin pour rafraîchir la
 * checklist si visible.
 */
function useMilestoneMutation(
  fn: (userId: string) => Promise<void>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => fn(userId),
    onSettled: (_, __, userId) => {
      void qc.invalidateQueries({
        queryKey: onboardingKeys.progress(userId),
      });
    },
  });
}

export const useMarkWelcomedMutation = () => useMilestoneMutation(markWelcomed);

export const useMarkFirstConcoursJoinedMutation = () =>
  useMilestoneMutation(markFirstConcoursJoined);

export const useMarkFirstPronoSavedMutation = () =>
  useMilestoneMutation(markFirstPronoSaved);

export const useMarkFirstClassementViewedMutation = () =>
  useMilestoneMutation(markFirstClassementViewed);

export const useMarkFirstInviteSentMutation = () =>
  useMilestoneMutation(markFirstInviteSent);

// ------------------------------------------------------------------
//  MUTATIONS — tour
// ------------------------------------------------------------------

export const useMarkTourStepCompletedMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, stepId }: { userId: string; stepId: TourStepId }) =>
      markTourStepCompleted(userId, stepId),
    onSettled: (_, __, { userId }) => {
      void qc.invalidateQueries({
        queryKey: onboardingKeys.progress(userId),
      });
    },
  });
};

export const useSkipTourMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => skipTour(userId, TOUR_STEP_IDS),
    onSettled: (_, __, userId) => {
      void qc.invalidateQueries({
        queryKey: onboardingKeys.progress(userId),
      });
    },
  });
};

// ------------------------------------------------------------------
//  MUTATIONS — checklist
// ------------------------------------------------------------------

export const useDismissChecklistMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => dismissChecklist(userId),
    // Optimistic update : on masque la checklist immédiatement
    onMutate: async (userId) => {
      await qc.cancelQueries({ queryKey: onboardingKeys.progress(userId) });
      const prev = qc.getQueryData<OnboardingProgressRow | null>(
        onboardingKeys.progress(userId),
      );
      qc.setQueryData<OnboardingProgressRow | null>(
        onboardingKeys.progress(userId),
        (curr) =>
          curr
            ? { ...curr, checklist_dismissed_at: new Date().toISOString() }
            : curr,
      );
      return { prev };
    },
    onError: (_, userId, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(onboardingKeys.progress(userId), ctx.prev);
      }
    },
    onSettled: (_, __, userId) => {
      void qc.invalidateQueries({
        queryKey: onboardingKeys.progress(userId),
      });
    },
  });
};

export const useRestoreChecklistMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => restoreChecklist(userId),
    onSettled: (_, __, userId) => {
      void qc.invalidateQueries({
        queryKey: onboardingKeys.progress(userId),
      });
    },
  });
};
