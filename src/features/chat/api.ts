import { supabase } from '@/lib/supabase';

import {
  type MessageWithAuthor,
  normalizeMessageWithAuthor,
} from './schemas';

/**
 * API Supabase pour la feature chat (Sprint 6.B).
 *
 * Toutes les opérations lisent/écrivent `public.concours_messages`,
 * protégée par RLS (membres du concours uniquement). Les erreurs
 * RLS (`42501`) sont propagées telles quelles : l'UI les mappe
 * ensuite sur un message fallback.
 *
 * Convention select :
 *   - on select colonnes explicites + `author:profiles(id, prenom, nom, avatar_url)`
 *   - tri `created_at desc` côté SQL (index dédié)
 *   - on retourne au front dans l'ordre chronologique ASC (plus
 *     ancien → plus récent) pour l'affichage bulle "Slack-style" ;
 *     c'est `listMessages` qui fait le `reverse()`.
 */

// ------------------------------------------------------------------
//  CONSTANTES
// ------------------------------------------------------------------

/** Taille de page par défaut pour la pagination remontante. */
export const DEFAULT_PAGE_SIZE = 50;

// ------------------------------------------------------------------
//  LIST (pagination remontante "load older")
// ------------------------------------------------------------------

/**
 * Récupère une page de messages (les plus récents d'abord côté SQL).
 *
 * - `before` : ISO string d'un `created_at` déjà vu. On retourne les
 *   messages strictement antérieurs. Utilisé par le bouton "Charger
 *   plus ancien" en haut de la liste.
 * - `limit` : nombre max de messages (défaut 50).
 *
 * Le résultat est renvoyé **chronologiquement ascendant** (plus
 * ancien → plus récent) pour que le front puisse prepend directement
 * la page en haut de la liste sans re-tri.
 */
export const listMessages = async (
  concoursId: string,
  options: { before?: string; limit?: number } = {},
): Promise<MessageWithAuthor[]> => {
  const { before, limit = DEFAULT_PAGE_SIZE } = options;

  let query = supabase
    .from('concours_messages')
    .select(
      'id, concours_id, user_id, body, created_at, author:profiles(id, prenom, nom, avatar_url)',
    )
    .eq('concours_id', concoursId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data) return [];

  // Supabase renvoie `author` comme objet unique via le join FK
  // mais typé comme tableau dans les types générés. On extrait
  // le premier élément puis on normalise.
  const normalized = data
    .map((row) => {
      const raw = row as unknown as {
        id: string | null;
        concours_id: string | null;
        user_id: string | null;
        body: string | null;
        created_at: string | null;
        author:
          | {
              id: string | null;
              prenom: string | null;
              nom: string | null;
              avatar_url: string | null;
            }
          | Array<{
              id: string | null;
              prenom: string | null;
              nom: string | null;
              avatar_url: string | null;
            }>
          | null;
      };
      const author = Array.isArray(raw.author)
        ? (raw.author[0] ?? null)
        : raw.author;
      return normalizeMessageWithAuthor({
        id: raw.id,
        concours_id: raw.concours_id,
        user_id: raw.user_id,
        body: raw.body,
        created_at: raw.created_at,
        author,
      });
    })
    .filter((m): m is MessageWithAuthor => m !== null);

  // SQL descending → on inverse pour l'affichage ascending
  return normalized.reverse();
};

// ------------------------------------------------------------------
//  INSERT (envoi)
// ------------------------------------------------------------------

/**
 * Envoie un nouveau message. Retourne le message créé avec l'auteur
 * joint (pour que l'UI puisse faire une optimistic update propre).
 *
 * Le `user_id` est injecté depuis la session côté SQL via la policy
 * `with check (... and user_id = auth.uid())`. On le lit ici en
 * JavaScript pour que le row inséré contienne bien le bon user_id.
 */
export const sendMessage = async (
  concoursId: string,
  body: string,
): Promise<MessageWithAuthor> => {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('chat.errors.notAuthenticated');

  const { data, error } = await supabase
    .from('concours_messages')
    .insert({
      concours_id: concoursId,
      user_id: user.id,
      body,
    })
    .select(
      'id, concours_id, user_id, body, created_at, author:profiles(id, prenom, nom, avatar_url)',
    )
    .single();

  if (error) throw error;
  if (!data) throw new Error('chat.errors.insertFailed');

  const raw = data as unknown as {
    id: string | null;
    concours_id: string | null;
    user_id: string | null;
    body: string | null;
    created_at: string | null;
    author:
      | {
          id: string | null;
          prenom: string | null;
          nom: string | null;
          avatar_url: string | null;
        }
      | Array<{
          id: string | null;
          prenom: string | null;
          nom: string | null;
          avatar_url: string | null;
        }>
      | null;
  };
  const author = Array.isArray(raw.author)
    ? (raw.author[0] ?? null)
    : raw.author;

  const normalized = normalizeMessageWithAuthor({
    id: raw.id,
    concours_id: raw.concours_id,
    user_id: raw.user_id,
    body: raw.body,
    created_at: raw.created_at,
    author,
  });
  if (!normalized) throw new Error('chat.errors.insertFailed');
  return normalized;
};

// ------------------------------------------------------------------
//  GET ONE (pour Realtime : enrichir un payload INSERT brut qui ne
//  contient pas le join `author`)
// ------------------------------------------------------------------

/**
 * Récupère un message unique avec son auteur joint.
 * Utilisé par `useChatRealtime` pour enrichir un payload Realtime
 * (qui ne contient pas le join profiles).
 *
 * Retourne `null` si le message n'existe plus (supprimé entre
 * l'event et le fetch) ou si la RLS le cache.
 */
export const getMessageById = async (
  id: string,
): Promise<MessageWithAuthor | null> => {
  const { data, error } = await supabase
    .from('concours_messages')
    .select(
      'id, concours_id, user_id, body, created_at, author:profiles(id, prenom, nom, avatar_url)',
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const raw = data as unknown as {
    id: string | null;
    concours_id: string | null;
    user_id: string | null;
    body: string | null;
    created_at: string | null;
    author:
      | {
          id: string | null;
          prenom: string | null;
          nom: string | null;
          avatar_url: string | null;
        }
      | Array<{
          id: string | null;
          prenom: string | null;
          nom: string | null;
          avatar_url: string | null;
        }>
      | null;
  };
  const author = Array.isArray(raw.author)
    ? (raw.author[0] ?? null)
    : raw.author;

  return normalizeMessageWithAuthor({
    id: raw.id,
    concours_id: raw.concours_id,
    user_id: raw.user_id,
    body: raw.body,
    created_at: raw.created_at,
    author,
  });
};
