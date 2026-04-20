import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';

import {
  listAllPronosPointsInConcours,
  listClassement,
  listPronosPointsForUser,
} from './api';
import {
  type ClassementRow,
  type PronoPointsRow,
} from './schemas';

/**
 * Hooks TanStack Query + Realtime pour le classement.
 *
 * Convention de queryKey :
 *   ['classement', concoursId]
 *   ['classement', concoursId, 'pronos-points', userId]
 *   ['classement', concoursId, 'pronos-points', 'all']
 *
 * Stratégie Realtime :
 *   - Les vues ne sont pas supportées par Realtime → on s'abonne aux
 *     tables sources (`matchs`, `pronos`) et on invalide les queries
 *     dérivées à la volée.
 *   - UPDATE matchs (score / status) recalcule potentiellement tout le
 *     classement du concours → on invalide la key agrégée.
 *   - INSERT/UPDATE/DELETE pronos filtré sur `concours_id` : même
 *     logique. La RLS filtrera de toute façon les events côté client,
 *     donc on ne reçoit que les deltas qu'on est autorisé à voir.
 */

// ------------------------------------------------------------------
//  KEYS
// ------------------------------------------------------------------

export const classementKeys = {
  all: ['classement'] as const,
  byConcours: (concoursId: string | undefined) =>
    ['classement', concoursId ?? 'none'] as const,
  pronosPointsForUser: (
    concoursId: string | undefined,
    userId: string | undefined,
  ) =>
    [
      'classement',
      concoursId ?? 'none',
      'pronos-points',
      userId ?? 'none',
    ] as const,
  pronosPointsAll: (concoursId: string | undefined) =>
    ['classement', concoursId ?? 'none', 'pronos-points', 'all'] as const,
};

// ------------------------------------------------------------------
//  QUERIES
// ------------------------------------------------------------------

/**
 * Classement agrégé d'un concours.
 * `staleTime: 10s` : l'utilisateur peut scroller la page sans déclencher
 * une salve de refetch, mais ça reste court pour ne pas afficher un
 * classement obsolète. Les invalidations Realtime prennent le relais.
 */
export const useClassementQuery = (concoursId: string | undefined) =>
  useQuery<ClassementRow[]>({
    queryKey: classementKeys.byConcours(concoursId),
    queryFn: () => listClassement(concoursId as string),
    enabled: Boolean(concoursId),
    staleTime: 10_000,
  });

/**
 * Détail des points par match pour un user (self ou autre, RLS filtre).
 */
export const usePronosPointsForUserQuery = (
  concoursId: string | undefined,
  userId: string | undefined,
) =>
  useQuery<PronoPointsRow[]>({
    queryKey: classementKeys.pronosPointsForUser(concoursId, userId),
    queryFn: () =>
      listPronosPointsForUser(concoursId as string, userId as string),
    enabled: Boolean(concoursId && userId),
    staleTime: 10_000,
  });

/**
 * Détail des points pour tous les users d'un concours (matchs finis).
 */
export const useAllPronosPointsInConcoursQuery = (
  concoursId: string | undefined,
) =>
  useQuery<PronoPointsRow[]>({
    queryKey: classementKeys.pronosPointsAll(concoursId),
    queryFn: () => listAllPronosPointsInConcours(concoursId as string),
    enabled: Boolean(concoursId),
    staleTime: 10_000,
  });

// ------------------------------------------------------------------
//  REALTIME
// ------------------------------------------------------------------

/**
 * Abonne le composant aux changements temps réel qui peuvent affecter
 * le classement d'un concours. Invalide les queries concernées via
 * TanStack Query.
 *
 * ⚠️ Les vues ne sont pas publiables en Realtime ; on s'abonne donc aux
 * tables sources (`matchs`, `pronos`). La migration Sprint 4 ajoute ces
 * deux tables à la publication `supabase_realtime`.
 *
 * Filtres :
 *   - `matchs` : pas de filtre (un changement de score / status impacte
 *     toutes les concours liés à cette compétition). Les events ne sont
 *     envoyés qu'aux utilisateurs autorisés par la RLS de matchs
 *     (SELECT ouvert ici → tous les authentifiés la reçoivent).
 *   - `pronos` : filtre sur `concours_id` pour limiter le bruit réseau
 *     au concours en cours d'affichage.
 *
 * Cycle de vie : on nettoie le channel au démontage ou au changement de
 * `concoursId` / `enabled`.
 */
export const useClassementRealtime = (
  concoursId: string | undefined,
  options: { enabled?: boolean } = {},
): void => {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !concoursId) return;

    const invalidate = () => {
      void queryClient.invalidateQueries({
        queryKey: classementKeys.byConcours(concoursId),
      });
      void queryClient.invalidateQueries({
        queryKey: ['classement', concoursId, 'pronos-points'],
      });
    };

    const channel = supabase
      .channel(`classement:${concoursId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matchs',
        },
        invalidate,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pronos',
          filter: `concours_id=eq.${concoursId}`,
        },
        invalidate,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [concoursId, enabled, queryClient]);
};
