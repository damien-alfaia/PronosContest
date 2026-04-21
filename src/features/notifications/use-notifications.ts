import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';

import {
  DEFAULT_PAGE_SIZE,
  countUnreadNotifications,
  getNotificationById,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from './api';
import {
  type Notification,
  compareNotificationByRecent,
} from './schemas';

/**
 * Hooks TanStack Query + Realtime pour la feature notifications
 * (Sprint 6.C).
 *
 * Convention de queryKey :
 *   ['notifications', userId, 'list']        → liste paginée
 *   ['notifications', userId, 'unread-count'] → compteur badge cloche
 *
 * Infinite query :
 *   - Les notifications sont chargées en ordre **DESC** (plus récent
 *     en premier) — contrairement au chat, pas de reverse côté front.
 *   - `initialPageParam: undefined` → 1re page = `DEFAULT_PAGE_SIZE`
 *     notifs les plus récentes.
 *   - `getNextPageParam(lastPage)` → `before = lastPage[last]?.created_at`
 *     (le plus ancien de la page courante, puisque DESC).
 *   - `data.pages` est naturellement dans l'ordre d'affichage : pages[0]
 *     = plus récentes, pages[N] = plus anciennes. `flat()` suffit pour
 *     obtenir la liste linéaire DESC.
 *
 * Realtime :
 *   - Seul l'event INSERT est écouté pour nouvelle notif. On ne se
 *     soucie pas des UPDATE (`read_at`) en Realtime : c'est toujours
 *     l'action locale de l'user qui change `read_at`, on traite ça via
 *     optimistic updates dans les mutations `markAsRead(All)`.
 *   - Le payload INSERT contient toutes les colonnes, mais on re-fetch
 *     via `getNotificationById` pour traverser la même normalisation
 *     que la liste — ça évite toute divergence de format.
 *
 * Mutations `markAsRead` / `markAllAsRead` :
 *   - Optimistic update sur la cache `list` (patch `read_at` sur les
 *     notifs concernées, sans réordonner) + sur la cache `unread-count`
 *     (décrément / mise à zéro immédiate).
 *   - Le filtre `.is('read_at', null)` côté SQL rend l'UPDATE idempotent
 *     → une double-clic ne pose pas de problème.
 */

// ------------------------------------------------------------------
//  KEYS
// ------------------------------------------------------------------

export const notificationsKeys = {
  all: ['notifications'] as const,
  list: (userId: string | undefined) =>
    ['notifications', userId ?? 'none', 'list'] as const,
  unreadCount: (userId: string | undefined) =>
    ['notifications', userId ?? 'none', 'unread-count'] as const,
};

// ------------------------------------------------------------------
//  TYPES
// ------------------------------------------------------------------

/** Une page = une tranche de notifications triées DESC (plus récent d'abord). */
export type NotificationsPage = Notification[];

/** Forme TanStack Query exposée par `useNotificationsInfiniteQuery`. */
export type NotificationsInfiniteData = InfiniteData<
  NotificationsPage,
  string | undefined
>;

// ------------------------------------------------------------------
//  HELPERS
// ------------------------------------------------------------------

/**
 * Aplatit les pages en une seule liste DESC (plus récent → plus ancien).
 * Contrairement au chat, pas de reverse : l'API renvoie déjà en DESC et
 * c'est l'ordre d'affichage naturel pour un centre de notifications.
 */
export const flattenNotifications = (
  data: NotificationsInfiniteData | undefined,
): Notification[] => {
  if (!data) return [];
  return data.pages.flat();
};

// ------------------------------------------------------------------
//  INFINITE QUERY
// ------------------------------------------------------------------

/**
 * Infinite query pour charger les notifications d'un user avec
 * pagination "Charger plus" (vers les plus anciennes).
 *
 * `staleTime: 30_000` : aligné avec le chat — le Realtime fait le
 * travail entre deux renders, et un remount après 30 s re-fetche
 * la 1re page (utile si un event Realtime a été raté).
 */
export const useNotificationsInfiniteQuery = (userId: string | undefined) =>
  useInfiniteQuery<
    NotificationsPage,
    Error,
    NotificationsInfiniteData,
    ReturnType<typeof notificationsKeys.list>,
    string | undefined
  >({
    queryKey: notificationsKeys.list(userId),
    queryFn: ({ pageParam }) =>
      listNotifications(userId as string, { before: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => {
      // Page incomplète → on a atteint le plus ancien.
      if (lastPage.length < DEFAULT_PAGE_SIZE) return undefined;
      // Cursor = created_at de la dernière notif (la plus ancienne
      // puisque la page est DESC).
      return lastPage[lastPage.length - 1]?.created_at;
    },
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

// ------------------------------------------------------------------
//  UNREAD COUNT QUERY
// ------------------------------------------------------------------

/**
 * Compteur non-lues pour le badge de la cloche. Requête dédiée : ça
 * laisse le count fonctionner même avant que la liste complète ne soit
 * chargée (ex : user qui se connecte et voit la cloche dans la Topbar
 * sans ouvrir la pop-up).
 */
export const useUnreadCountQuery = (userId: string | undefined) =>
  useQuery<number, Error>({
    queryKey: notificationsKeys.unreadCount(userId),
    queryFn: () => countUnreadNotifications(userId as string),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

// ------------------------------------------------------------------
//  MUTATION : marquer une notif comme lue
// ------------------------------------------------------------------

type MarkAsReadContext = {
  listSnapshot: NotificationsInfiniteData | undefined;
  countSnapshot: number | undefined;
  wasUnread: boolean;
};

/**
 * Marque une notification comme lue avec optimistic update.
 *
 * onMutate :
 *   1. Cancel les fetchs sur list + unread-count.
 *   2. Snapshot (pour rollback).
 *   3. Patch `read_at` sur la notif concernée dans toutes les pages.
 *   4. Décrémente le compteur si la notif était non lue
 *      (sinon idempotent : on ne touche pas au compteur).
 *
 * onError : rollback.
 * onSettled : invalidate list + count (le SQL filtre `.is('read_at',
 *   null)` rend l'UPDATE idempotent, donc pas de bug si on invalide).
 */
export const useMarkAsReadMutation = (userId: string | undefined) => {
  const queryClient = useQueryClient();
  const listKey = notificationsKeys.list(userId);
  const countKey = notificationsKeys.unreadCount(userId);

  return useMutation<void, Error, string, MarkAsReadContext>({
    mutationFn: (id) => markNotificationAsRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      await queryClient.cancelQueries({ queryKey: countKey });

      const listSnapshot =
        queryClient.getQueryData<NotificationsInfiniteData>(listKey);
      const countSnapshot = queryClient.getQueryData<number>(countKey);

      // Détermine si la notif était non lue avant le patch — on ne
      // décrémente le compteur que dans ce cas pour rester idempotent.
      let wasUnread = false;
      if (listSnapshot) {
        for (const page of listSnapshot.pages) {
          const found = page.find((n) => n.id === id);
          if (found) {
            wasUnread = found.read_at === null;
            break;
          }
        }
      }

      const nowIso = new Date().toISOString();

      if (listSnapshot) {
        queryClient.setQueryData<NotificationsInfiniteData>(listKey, {
          ...listSnapshot,
          pages: listSnapshot.pages.map((page) =>
            page.map((n) =>
              n.id === id && n.read_at === null
                ? { ...n, read_at: nowIso }
                : n,
            ),
          ),
        });
      }

      if (typeof countSnapshot === 'number' && wasUnread) {
        queryClient.setQueryData<number>(countKey, Math.max(0, countSnapshot - 1));
      }

      return { listSnapshot, countSnapshot, wasUnread };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.listSnapshot) {
        queryClient.setQueryData(listKey, ctx.listSnapshot);
      }
      if (typeof ctx?.countSnapshot === 'number') {
        queryClient.setQueryData(countKey, ctx.countSnapshot);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: listKey });
      void queryClient.invalidateQueries({ queryKey: countKey });
    },
  });
};

// ------------------------------------------------------------------
//  MUTATION : tout marquer comme lu
// ------------------------------------------------------------------

type MarkAllAsReadContext = {
  listSnapshot: NotificationsInfiniteData | undefined;
  countSnapshot: number | undefined;
};

/**
 * Marque toutes les notifications non-lues d'un user comme lues. Le
 * bouton "Tout marquer comme lu" dans la pop-up cloche appelle cette
 * mutation.
 *
 * onMutate :
 *   1. Cancel les fetchs.
 *   2. Snapshot.
 *   3. Patch `read_at = now()` sur toutes les notifs non-lues dans
 *      toutes les pages.
 *   4. Force le compteur à 0.
 *
 * onError : rollback. onSettled : invalidate.
 */
export const useMarkAllAsReadMutation = (userId: string | undefined) => {
  const queryClient = useQueryClient();
  const listKey = notificationsKeys.list(userId);
  const countKey = notificationsKeys.unreadCount(userId);

  return useMutation<void, Error, void, MarkAllAsReadContext>({
    mutationFn: () => {
      if (!userId) throw new Error('notifications.errors.noUser');
      return markAllNotificationsAsRead(userId);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: listKey });
      await queryClient.cancelQueries({ queryKey: countKey });

      const listSnapshot =
        queryClient.getQueryData<NotificationsInfiniteData>(listKey);
      const countSnapshot = queryClient.getQueryData<number>(countKey);

      const nowIso = new Date().toISOString();

      if (listSnapshot) {
        queryClient.setQueryData<NotificationsInfiniteData>(listKey, {
          ...listSnapshot,
          pages: listSnapshot.pages.map((page) =>
            page.map((n) =>
              n.read_at === null ? { ...n, read_at: nowIso } : n,
            ),
          ),
        });
      }

      queryClient.setQueryData<number>(countKey, 0);

      return { listSnapshot, countSnapshot };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.listSnapshot) {
        queryClient.setQueryData(listKey, ctx.listSnapshot);
      }
      if (typeof ctx?.countSnapshot === 'number') {
        queryClient.setQueryData(countKey, ctx.countSnapshot);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: listKey });
      void queryClient.invalidateQueries({ queryKey: countKey });
    },
  });
};

// ------------------------------------------------------------------
//  REALTIME
// ------------------------------------------------------------------

/**
 * Souscrit aux INSERT temps réel sur `notifications` filtré par
 * `user_id`. Pour chaque event :
 *   1. Re-fetch via `getNotificationById` pour traverser la même
 *      normalisation que la liste (et éviter de dépendre du format
 *      exact du payload Realtime).
 *   2. Prepend dans `pages[0]` puis re-trie DESC (défense en profondeur
 *      — si deux events arrivent dans un ordre inattendu, on reste
 *      cohérent).
 *   3. Incrémente le compteur d'1 (les notifs INSERT arrivent toujours
 *      `read_at = null` — triggers SECURITY DEFINER côté SQL).
 *
 * Dédup : si la page 0 contient déjà une notif avec le même `id`
 * (rare mais possible si un fetch manuel a déjà remonté la notif),
 * on la remplace plutôt que d'ajouter.
 *
 * Cycle de vie : channel unique par `userId`, nettoyé au démontage
 * ou au changement de `userId` / `enabled`.
 */
export const useNotificationsRealtime = (
  userId: string | undefined,
  options: { enabled?: boolean } = {},
): void => {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !userId) return;

    const listKey = notificationsKeys.list(userId);
    const countKey = notificationsKeys.unreadCount(userId);

    const channel = supabase
      .channel(`user-notifs:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newRow = payload.new as { id?: string } | null;
          if (!newRow?.id) return;

          const notificationId = newRow.id;

          void (async () => {
            const notif = await getNotificationById(notificationId).catch(
              () => null,
            );
            if (!notif) return;

            queryClient.setQueryData<NotificationsInfiniteData>(
              listKey,
              (old) => {
                if (!old) {
                  // Pas encore de cache : laisse l'initial fetch faire.
                  return old;
                }

                const [firstPage = [], ...rest] = old.pages;

                // Dédup par id — évite le double-rendu si un fetch
                // parallèle a déjà remonté la même notif.
                const dedup = firstPage.filter((n) => n.id !== notif.id);

                const nextFirst = [notif, ...dedup].sort(
                  compareNotificationByRecent,
                );

                return {
                  ...old,
                  pages: [nextFirst, ...rest],
                };
              },
            );

            // Incrément du compteur (notif fraîche → toujours non lue).
            queryClient.setQueryData<number>(countKey, (old) =>
              typeof old === 'number' ? old + 1 : old,
            );
          })();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, enabled, queryClient]);
};
