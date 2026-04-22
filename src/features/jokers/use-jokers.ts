import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';

import {
  countUserOwnedJokersInConcours,
  listJokersCatalog,
  listUserJokersInConcours,
  setConcoursJokersEnabled,
} from './api';
import { type JokerCatalogRow, type UserJokerWithCatalog } from './schemas';

/**
 * Hooks TanStack Query + Realtime pour les jokers (Sprint 8.A).
 *
 * Convention de queryKey :
 *   ['jokers', 'catalog']
 *   ['jokers', 'user', userId, concoursId]
 *   ['jokers', 'user', userId, concoursId, 'count']
 *
 * Stratégie Realtime :
 *   - La publication `supabase_realtime` inclut `user_jokers` (ajout
 *     dans la migration Sprint 8.A).
 *   - Les triggers SQL (participant_insert, badge_earned, concours_enable)
 *     attribuent les jokers en arrière-plan : un INSERT dans user_jokers
 *     déclenche l'invalidation côté front.
 *   - On filtre sur `user_id=eq.${userId}` + concours_id pour ne recevoir
 *     que les events pertinents. La RLS filtre déjà côté serveur.
 *
 * Pas de Realtime sur le catalogue : immuable à l'échelle d'une session
 * (seed uniquement, modifié via migration).
 *
 * Pour le toggle `jokers_enabled` (owner), l'invalidation de la query
 * `['concours', 'detail', id]` (Sprint 2) est faite via `onSuccess` —
 * on ne touche pas à la queryKey jokers, puisque c'est le trigger SQL
 * qui va pousser les user_jokers via Realtime.
 */

// ------------------------------------------------------------------
//  KEYS
// ------------------------------------------------------------------

export const jokersKeys = {
  all: ['jokers'] as const,
  catalog: () => ['jokers', 'catalog'] as const,
  userAll: (userId: string | undefined, concoursId: string | undefined) =>
    ['jokers', 'user', userId ?? 'none', concoursId ?? 'none'] as const,
  userCount: (userId: string | undefined, concoursId: string | undefined) =>
    [
      'jokers',
      'user',
      userId ?? 'none',
      concoursId ?? 'none',
      'count',
    ] as const,
};

// ------------------------------------------------------------------
//  QUERIES
// ------------------------------------------------------------------

/**
 * Catalogue complet (7 jokers seedés). `staleTime: 1h` : lecture
 * publique, modifié uniquement via migration, pas la peine de refetch
 * à chaque montage.
 */
export const useJokersCatalogQuery = () =>
  useQuery<JokerCatalogRow[]>({
    queryKey: jokersKeys.catalog(),
    queryFn: listJokersCatalog,
    staleTime: 60 * 60 * 1000, // 1h
  });

/**
 * Jokers d'un user dans un concours (jointurés avec le catalogue).
 * `staleTime: 30s` : suffisant pour la section "Mes jokers" qu'on ne
 * refresh pas frénétiquement, complété par l'invalidation Realtime.
 */
export const useUserJokersInConcoursQuery = (
  userId: string | undefined,
  concoursId: string | undefined,
) =>
  useQuery<UserJokerWithCatalog[]>({
    queryKey: jokersKeys.userAll(userId, concoursId),
    queryFn: () =>
      listUserJokersInConcours(userId as string, concoursId as string),
    enabled: Boolean(userId) && Boolean(concoursId),
    staleTime: 30_000,
  });

/**
 * Compteur de jokers "owned" (non-utilisés) d'un user dans un concours.
 * Pour widgets / badges de la section jokers.
 */
export const useUserOwnedJokersCountQuery = (
  userId: string | undefined,
  concoursId: string | undefined,
) =>
  useQuery<number>({
    queryKey: jokersKeys.userCount(userId, concoursId),
    queryFn: () =>
      countUserOwnedJokersInConcours(userId as string, concoursId as string),
    enabled: Boolean(userId) && Boolean(concoursId),
    staleTime: 30_000,
  });

// ------------------------------------------------------------------
//  MUTATIONS
// ------------------------------------------------------------------

/**
 * Toggle `concours.jokers_enabled` (owner only via RLS).
 *
 * Invalide la query de détail du concours (pour que la UI reflète
 * le flag à jour) + les listes de jokers du user courant sur ce
 * concours (le trigger SQL va y écrire les starters dès le passage
 * false → true). Le Realtime fera le reste pour les autres users.
 */
export const useSetConcoursJokersEnabledMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      concoursId,
      enabled,
    }: {
      concoursId: string;
      enabled: boolean;
    }) => setConcoursJokersEnabled(concoursId, enabled),

    onSuccess: (_data, variables) => {
      // Fiche concours : reflect the jokers_enabled flag
      void queryClient.invalidateQueries({
        queryKey: ['concours', 'detail', variables.concoursId],
      });
      // Au cas où d'autres listes (mes concours, publics) affichent le flag
      void queryClient.invalidateQueries({
        queryKey: ['concours'],
      });
      // Les listes de jokers utilisateur vont être rafraîchies via Realtime
      // sur user_jokers, mais on invalide par sécurité pour les users
      // autres que celui qui a toggle (ex : l'owner n'est pas encore
      // participant — cas rare).
      void queryClient.invalidateQueries({
        queryKey: jokersKeys.all,
      });
    },
  });
};

// ------------------------------------------------------------------
//  REALTIME
// ------------------------------------------------------------------

/**
 * Abonne le composant aux INSERT / UPDATE / DELETE sur `user_jokers`
 * pour l'user + concours demandés. Invalide les queries liste + count
 * à chaque event.
 *
 * Les filtres Realtime Supabase ne supportent qu'une condition simple
 * (`col=eq.val`), on filtre donc sur `user_id` côté serveur, et on
 * affine par `concours_id` côté client (la payload `new`/`old`
 * contient le concours_id).
 *
 * Cycle de vie : channel unique par (userId, concoursId), nettoyé
 * au démontage ou au changement de clés.
 */
export const useUserJokersRealtime = (
  userId: string | undefined,
  concoursId: string | undefined,
  options: { enabled?: boolean } = {},
): void => {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !userId || !concoursId) return;

    const invalidate = () => {
      void queryClient.invalidateQueries({
        queryKey: jokersKeys.userAll(userId, concoursId),
      });
      void queryClient.invalidateQueries({
        queryKey: jokersKeys.userCount(userId, concoursId),
      });
    };

    const channel = supabase
      .channel(`user-jokers:${userId}:${concoursId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_jokers',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // Affine par concours_id côté client.
          const row = (payload.new ?? payload.old) as
            | { concours_id?: string }
            | undefined;
          if (row?.concours_id === concoursId) {
            invalidate();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, concoursId, enabled, queryClient]);
};
