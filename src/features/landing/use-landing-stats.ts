import { useQuery } from '@tanstack/react-query';

import { getLandingStats, type LandingStats } from './api';

/**
 * Hooks TanStack Query pour les statistiques publiques de la landing.
 *
 * Convention de queryKey :
 *   ['landing', 'stats']
 *
 * staleTime 5 min : la landing n'a pas besoin d'être ultra-réactive
 * sur les compteurs (le social proof "~X concours" reste crédible
 * même si retardé de quelques minutes). Moins de load côté DB.
 *
 * Pas d'auth requise (RPC `get_landing_stats` ouverte à anon).
 */

export const landingKeys = {
  all: ['landing'] as const,
  stats: () => ['landing', 'stats'] as const,
};

export const useLandingStatsQuery = () =>
  useQuery<LandingStats>({
    queryKey: landingKeys.stats(),
    queryFn: getLandingStats,
    staleTime: 5 * 60 * 1000, // 5 min
    // Pas de retry agressif : si la landing échoue sur les stats, on
    // affiche un fallback plutôt que de bombarder le backend.
    retry: 1,
  });
