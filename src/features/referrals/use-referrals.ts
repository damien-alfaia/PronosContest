import { useQuery } from '@tanstack/react-query';

import { countMyReferrals } from './api';

/**
 * Hooks TanStack Query pour la feature referrals.
 *
 * Convention de queryKey :
 *   ['referrals', 'count', userId]
 *
 * staleTime 30 s : le count change uniquement quand un invité rejoint,
 * ce qui n'arrive pas à la seconde. L'invalidation explicite se fait
 * dans les mutations qui pourraient affecter (ex. useJoinByCodeMutation).
 */

export const referralsKeys = {
  all: ['referrals'] as const,
  count: (userId: string | undefined) =>
    ['referrals', 'count', userId ?? 'none'] as const,
};

/**
 * Compte le nombre d'invités de l'user (tous concours confondus).
 * Utilisé par `<ReferralBanner />` pour la progress bar milestone.
 */
export const useMyReferralsCountQuery = (userId: string | undefined) =>
  useQuery<number>({
    queryKey: referralsKeys.count(userId),
    queryFn: () => countMyReferrals(userId as string),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
