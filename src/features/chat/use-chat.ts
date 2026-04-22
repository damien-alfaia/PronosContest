import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';

import {
  DEFAULT_PAGE_SIZE,
  getMessageById,
  listMessages,
  sendMessage,
} from './api';
import {
  type MessageWithAuthor,
  compareMessageByDateAsc,
} from './schemas';

/**
 * Hooks TanStack Query + Realtime pour la feature chat (Sprint 6.B).
 *
 * Convention de queryKey :
 *   ['chat', concoursId, 'messages']
 *
 * Infinite query (pagination remontante) :
 *   - `initialPageParam: undefined` → 1re page = `DEFAULT_PAGE_SIZE`
 *     messages les plus récents (l'API les renvoie en ASC après reverse
 *     interne).
 *   - `getNextPageParam(lastPage)` → `before = lastPage[0]?.created_at`
 *     (on pagine en "remontant" vers les plus anciens).
 *   - `data.pages` est dans l'ordre de chargement : pages[0] = le plus
 *     récent batch, pages[N] = le plus ancien batch. Pour un affichage
 *     chronologique ascendant (plus ancien en haut, plus récent en bas),
 *     l'UI fait `pages.slice().reverse().flat()` — voir
 *     `flattenMessagesAsc` ci-dessous.
 *
 * Realtime :
 *   - Seul l'event INSERT est écouté : les messages sont immuables au
 *     MVP (aucune policy UPDATE/DELETE côté SQL). Si on ajoute la
 *     modération plus tard, on étendra ce hook.
 *   - Le payload brut n'a pas le join `author` → on re-fetch via
 *     `getMessageById` avant de prepend dans la page la plus récente.
 *   - Dédup via `id` (et via `body + user_id` pour remplacer les
 *     messages optimistes dont l'id temporaire ≠ id serveur).
 */

// ------------------------------------------------------------------
//  KEYS
// ------------------------------------------------------------------

export const chatKeys = {
  all: ['chat'] as const,
  messages: (concoursId: string | undefined) =>
    ['chat', concoursId ?? 'none', 'messages'] as const,
};

// ------------------------------------------------------------------
//  TYPES
// ------------------------------------------------------------------

/** Une page = une tranche de messages triés ASC (plus ancien → plus récent). */
export type MessagesPage = MessageWithAuthor[];

/** Forme TanStack Query exposée par `useMessagesInfiniteQuery`. */
export type MessagesInfiniteData = InfiniteData<
  MessagesPage,
  string | undefined
>;

// ------------------------------------------------------------------
//  HELPERS
// ------------------------------------------------------------------

/**
 * Aplatit les pages en une seule liste chronologiquement ascendante.
 *
 * `data.pages[0]` contient le batch le plus récent (première page
 * chargée), `data.pages[N]` contient le batch le plus ancien. On
 * inverse l'ordre des pages puis on les flatten pour obtenir :
 * [plus ancien ... plus récent].
 */
export const flattenMessagesAsc = (
  data: MessagesInfiniteData | undefined,
): MessageWithAuthor[] => {
  if (!data) return [];
  return data.pages.slice().reverse().flat();
};

// ------------------------------------------------------------------
//  INFINITE QUERY
// ------------------------------------------------------------------

/**
 * Infinite query pour charger les messages d'un concours avec
 * pagination "remontante". Utiliser `fetchNextPage()` depuis l'UI
 * pour charger les messages plus anciens.
 *
 * `staleTime: 30_000` : on laisse le Realtime faire le boulot entre
 * deux renders. Un remount après 30 s re-fetche la 1re page.
 */
export const useMessagesInfiniteQuery = (concoursId: string | undefined) =>
  useInfiniteQuery<
    MessagesPage,
    Error,
    MessagesInfiniteData,
    ReturnType<typeof chatKeys.messages>,
    string | undefined
  >({
    queryKey: chatKeys.messages(concoursId),
    queryFn: ({ pageParam }) =>
      listMessages(concoursId as string, { before: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => {
      // Page complète → potentiellement plus ancien à charger.
      if (lastPage.length < DEFAULT_PAGE_SIZE) return undefined;
      // Cursor = created_at du message le plus ancien de la page.
      // (La page est ASC, donc c'est le premier élément.)
      return lastPage[0]?.created_at;
    },
    enabled: Boolean(concoursId),
    staleTime: 30_000,
  });

// ------------------------------------------------------------------
//  MUTATION : envoi
// ------------------------------------------------------------------

type SendContext = {
  snapshot: MessagesInfiniteData | undefined;
  tempId: string;
};

/**
 * Envoi d'un message avec optimistic update.
 *
 * onMutate :
 *   1. Cancel les fetchs sur la queryKey.
 *   2. Snapshot de l'état actuel (pour rollback).
 *   3. Insère un message "en attente" avec id temporaire
 *      `optimistic-${Date.now()}` à la fin de `pages[0]`.
 *
 * onError : rollback au snapshot.
 * onSettled : invalidate — le Realtime devrait avoir réconcilié, mais
 *   on refetch en double sécurité (cas offline / perte d'event).
 */
export const useSendMessageMutation = (
  concoursId: string | undefined,
  userId: string | undefined,
) => {
  const queryClient = useQueryClient();
  const key = chatKeys.messages(concoursId);

  return useMutation<MessageWithAuthor, Error, string, SendContext>({
    mutationFn: (body) => {
      if (!concoursId) throw new Error('chat.errors.noConcours');
      return sendMessage(concoursId, body);
    },
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: key });
      const snapshot =
        queryClient.getQueryData<MessagesInfiniteData>(key);

      const tempId = `optimistic-${Date.now()}`;

      if (snapshot && userId && concoursId) {
        const optimistic: MessageWithAuthor = {
          id: tempId,
          concours_id: concoursId,
          user_id: userId,
          body,
          created_at: new Date().toISOString(),
          author: null,
        };
        queryClient.setQueryData<MessagesInfiniteData>(key, {
          ...snapshot,
          pages: snapshot.pages.map((page, idx) =>
            // pages[0] = batch le plus récent → on append à la fin
            // (la page est triée ASC, le plus récent est à la fin).
            idx === 0 ? [...page, optimistic] : page,
          ),
        });
      }

      return { snapshot, tempId };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.snapshot) {
        queryClient.setQueryData(key, ctx.snapshot);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
};

// ------------------------------------------------------------------
//  REALTIME
// ------------------------------------------------------------------

/**
 * Souscrit aux INSERT temps réel sur `concours_messages` filtré par
 * `concours_id`. Pour chaque event :
 *   1. Le payload brut n'a pas le join `author` → on re-fetch via
 *      `getMessageById`.
 *   2. On prepend/append le message dans la page la plus récente
 *      (`pages[0]`) puis on re-trie ASC par `created_at`.
 *
 * Dédup :
 *   - Si la page 0 contient déjà un message avec le même `id`
 *     (écho Realtime de notre propre insert qui a déjà été fetché par
 *     la mutation), on remplace plutôt que d'ajouter.
 *   - Si la page 0 contient un message optimistic (`id` préfixé
 *     `optimistic-`) avec même `user_id + body`, on le retire : la
 *     mutation + le Realtime convergent vers un seul message final.
 *
 * Cycle de vie : channel unique par `concoursId`, nettoyé au démontage
 * ou au changement de `concoursId` / `enabled`.
 */
export const useChatRealtime = (
  concoursId: string | undefined,
  options: { enabled?: boolean } = {},
): void => {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !concoursId) return;

    const key = chatKeys.messages(concoursId);

    const channel = supabase
      .channel(`concours-chat:${concoursId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'concours_messages',
          filter: `concours_id=eq.${concoursId}`,
        },
        (payload) => {
          const newRow = payload.new as { id?: string } | null;
          if (!newRow?.id) return;

          const messageId = newRow.id;

          // Enrichissement : re-fetch pour avoir le join `author`.
          void (async () => {
            const msg = await getMessageById(messageId).catch(() => null);
            if (!msg) return;

            queryClient.setQueryData<MessagesInfiniteData>(key, (old) => {
              if (!old) {
                // Pas encore de cache : on laisse l'initial fetch faire.
                return old;
              }

              const [firstPage = [], ...rest] = old.pages;

              // Dédup : retire les doublons (id identique) et les
              // optimistics (préfixe `optimistic-`) qui matchent le
              // message serveur par (user_id, body).
              const dedup = firstPage.filter((m) => {
                if (m.id === msg.id) return false;
                if (
                  m.id.startsWith('optimistic-') &&
                  m.user_id === msg.user_id &&
                  m.body === msg.body
                ) {
                  return false;
                }
                return true;
              });

              const nextFirst = [...dedup, msg].sort(
                compareMessageByDateAsc,
              );

              return {
                ...old,
                pages: [nextFirst, ...rest],
              };
            });
          })();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [concoursId, enabled, queryClient]);
};
