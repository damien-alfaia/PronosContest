import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';

import { countUserBadges, listBadgesCatalog, listUserBadges } from './api';
import {
  type BadgeCatalogRow,
  type UserBadgeWithCatalog,
} from './schemas';

/**
 * Hooks TanStack Query + Realtime pour les badges.
 *
 * Convention de queryKey :
 *   ['badges', 'catalog']
 *   ['badges', 'user', userId]
 *   ['badges', 'user', userId, 'count']
 *
 * Stratégie Realtime :
 *   - La publication `supabase_realtime` inclut `user_badges` (ajout
 *     dans la migration Sprint 6.A).
 *   - Les triggers SQL attribuent les badges en arrière-plan : un INSERT
 *     dans user_badges déclenche l'invalidation côté front.
 *   - On filtre sur `user_id=eq.${userId}` pour ne recevoir que les
 *     events concernant l'utilisateur affiché (typiquement self sur la
 *     page profil). La RLS filtre déjà les events côté serveur.
 *
 * Pas de Realtime sur le catalogue : il est considéré comme immuable
 * à l'échelle d'une session (seed uniquement, modifié via migration).
 */

// ------------------------------------------------------------------
//  KEYS
// ------------------------------------------------------------------

export const badgesKeys = {
  all: ['badges'] as const,
  catalog: () => ['badges', 'catalog'] as const,
  userAll: (userId: string | undefined) =>
    ['badges', 'user', userId ?? 'none'] as const,
  userCount: (userId: string | undefined) =>
    ['badges', 'user', userId ?? 'none', 'count'] as const,
};

// ------------------------------------------------------------------
//  QUERIES
// ------------------------------------------------------------------

/**
 * Catalogue complet (28 badges en l'état). `staleTime: 1h` :
 * lecture publique, modifié uniquement via migration, pas la peine
 * de refetch à chaque montage.
 */
export const useBadgesCatalogQuery = () =>
  useQuery<BadgeCatalogRow[]>({
    queryKey: badgesKeys.catalog(),
    queryFn: listBadgesCatalog,
    staleTime: 60 * 60 * 1000, // 1h
  });

/**
 * Badges gagnés par un user (jointurés avec le catalogue).
 * `staleTime: 30s` : suffisant pour les pages profil qu'on ne refresh
 * pas frénétiquement, complété par l'invalidation Realtime.
 */
export const useUserBadgesQuery = (userId: string | undefined) =>
  useQuery<UserBadgeWithCatalog[]>({
    queryKey: badgesKeys.userAll(userId),
    queryFn: () => listUserBadges(userId as string),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

/**
 * Compteur de badges d'un user (pour dashboard / sidebar).
 * Pas de dépendance à la liste complète : requête `count: 'exact'`
 * pure, plus légère si on n'a pas besoin du détail.
 */
export const useUserBadgesCountQuery = (userId: string | undefined) =>
  useQuery<number>({
    queryKey: badgesKeys.userCount(userId),
    queryFn: () => countUserBadges(userId as string),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

// ------------------------------------------------------------------
//  REALTIME
// ------------------------------------------------------------------

/**
 * Abonne le composant aux INSERT / UPDATE / DELETE sur `user_badges`
 * pour l'user demandé. Invalide les queries liste + count à chaque
 * event.
 *
 * Le filtre `user_id=eq.${userId}` évite le bruit (on ne reçoit que
 * les events pour ce user). La RLS confirme côté serveur : impossible
 * de recevoir les badges d'autrui si on n'est pas dans un concours
 * commun — ce qui, pour la page profil (self), est toujours le cas.
 *
 * Cycle de vie : channel unique par userId, nettoyé au démontage ou
 * au changement de userId / enabled.
 */
export const useUserBadgesRealtime = (
  userId: string | undefined,
  options: { enabled?: boolean } = {},
): void => {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !userId) return;

    const invalidate = () => {
      void queryClient.invalidateQueries({
        queryKey: badgesKeys.userAll(userId),
      });
      void queryClient.invalidateQueries({
        queryKey: badgesKeys.userCount(userId),
      });
    };

    const channel = supabase
      .channel(`user-badges:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_badges',
          filter: `user_id=eq.${userId}`,
        },
        invalidate,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, enabled, queryClient]);
};
