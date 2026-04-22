import { z } from 'zod';

/**
 * Schémas Zod pour la feature chat (Sprint 6.B).
 *
 * Table SQL (migration `20260424120000_init_chat.sql`) :
 *   `concours_messages` (id, concours_id, user_id, body, created_at).
 *   - body CHECK `char_length(body) between 1 and 1000`
 *   - RLS : membres du concours uniquement (select + insert)
 *   - Immuable : pas d'UPDATE / DELETE au MVP
 *
 * On maintient deux vues :
 *   - `MessageRow` : brut depuis la table (sans join)
 *   - `MessageWithAuthor` : join `author:profiles(id, prenom, nom, avatar_url)`
 *     consommé par l'UI (on a besoin du nom + avatar pour afficher la bulle).
 */

// ------------------------------------------------------------------
//  LIMITES
// ------------------------------------------------------------------

export const MESSAGE_BODY_MIN = 1;
export const MESSAGE_BODY_MAX = 1000;

// ------------------------------------------------------------------
//  INPUT : envoi d'un message (formulaire)
// ------------------------------------------------------------------

/**
 * Schéma pour `MessageComposer`. On `trim()` côté Zod pour ne jamais
 * stocker un message "         " qui ferait quand même `char_length > 0`
 * en SQL. Le min(1) appliqué APRÈS le trim garantit qu'un utilisateur ne
 * peut pas envoyer juste des espaces.
 *
 * On n'utilise PAS `z.string().min(1).max(1000)` directement : le trim
 * est essentiel pour aligner le contrat front avec ce que le CHECK SQL
 * accepterait techniquement (SQL accepte '   ' car c'est 3 caractères).
 */
export const sendMessageSchema = z.object({
  body: z
    .string()
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .min(MESSAGE_BODY_MIN, { message: 'chat.errors.bodyRequired' })
        .max(MESSAGE_BODY_MAX, { message: 'chat.errors.bodyTooLong' }),
    ),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// ------------------------------------------------------------------
//  ROW : ligne brute de `concours_messages`
// ------------------------------------------------------------------

export const messageRowSchema = z.object({
  id: z.string().uuid(),
  concours_id: z.string().uuid(),
  user_id: z.string().uuid(),
  body: z.string().min(1),
  created_at: z.string(), // ISO-8601 (timestamptz sérialisé)
});
export type MessageRow = z.infer<typeof messageRowSchema>;

/**
 * Normalise une ligne brute remontée par Supabase. Retourne `null`
 * pour toute ligne incomplète / malformée, qui sera filtrée côté api.
 * (Défensif : les types générés par `supabase gen types` peuvent être
 * nullables même si la colonne ne l'est pas côté SQL, à cause des
 * views Realtime qui élargissent parfois la nullabilité.)
 */
export const normalizeMessageRow = (raw: {
  id: string | null;
  concours_id: string | null;
  user_id: string | null;
  body: string | null;
  created_at: string | null;
}): MessageRow | null => {
  if (!raw.id || !raw.concours_id || !raw.user_id || !raw.body || !raw.created_at) {
    return null;
  }
  const parsed = messageRowSchema.safeParse({
    id: raw.id,
    concours_id: raw.concours_id,
    user_id: raw.user_id,
    body: raw.body,
    created_at: raw.created_at,
  });
  return parsed.success ? parsed.data : null;
};

// ------------------------------------------------------------------
//  AUTHOR joint depuis `profiles`
// ------------------------------------------------------------------

export const messageAuthorSchema = z.object({
  id: z.string().uuid(),
  prenom: z.string().nullable(),
  nom: z.string().nullable(),
  avatar_url: z.string().nullable(),
});
export type MessageAuthor = z.infer<typeof messageAuthorSchema>;

/**
 * `MessageWithAuthor` : ce que l'UI consomme réellement.
 * On rend le `author` optionnel (pas `nullable`) pour gérer le cas où
 * le profil a été supprimé (cascade sur `profiles`) mais qu'un ancien
 * message apparaîtrait encore dans une page Realtime avant que le
 * cache soit invalidé. Dans ce cas, l'UI affiche un auteur fallback.
 */
export const messageWithAuthorSchema = messageRowSchema.extend({
  author: messageAuthorSchema.nullable(),
});
export type MessageWithAuthor = z.infer<typeof messageWithAuthorSchema>;

export const normalizeMessageWithAuthor = (raw: {
  id: string | null;
  concours_id: string | null;
  user_id: string | null;
  body: string | null;
  created_at: string | null;
  author: {
    id: string | null;
    prenom: string | null;
    nom: string | null;
    avatar_url: string | null;
  } | null;
}): MessageWithAuthor | null => {
  const row = normalizeMessageRow({
    id: raw.id,
    concours_id: raw.concours_id,
    user_id: raw.user_id,
    body: raw.body,
    created_at: raw.created_at,
  });
  if (!row) return null;

  let author: MessageAuthor | null = null;
  if (raw.author && raw.author.id) {
    author = {
      id: raw.author.id,
      prenom: raw.author.prenom,
      nom: raw.author.nom,
      avatar_url: raw.author.avatar_url,
    };
  }

  return { ...row, author };
};

// ------------------------------------------------------------------
//  HELPERS UI
// ------------------------------------------------------------------

/**
 * Libellé lisible pour un auteur (initiales + nom complet).
 * - Si `prenom/nom` présents : "Prénom Nom"
 * - Sinon : fallback "?"
 */
export const formatAuthorName = (author: MessageAuthor | null): string => {
  if (!author) return '?';
  const parts = [author.prenom, author.nom].filter(
    (p): p is string => Boolean(p && p.trim()),
  );
  return parts.length > 0 ? parts.join(' ') : '?';
};

/**
 * Initiales pour l'Avatar fallback (1 ou 2 lettres max).
 */
export const pickAuthorInitials = (author: MessageAuthor | null): string => {
  if (!author) return '?';
  const f = (author.prenom ?? '').trim()[0];
  const l = (author.nom ?? '').trim()[0];
  if (f || l) return `${f ?? ''}${l ?? ''}`.toUpperCase();
  return '?';
};

/**
 * Compare deux messages par date croissante (tri affichage : plus
 * anciens en haut, plus récents en bas, comme WhatsApp/Slack).
 */
export const compareMessageByDateAsc = (
  a: MessageWithAuthor,
  b: MessageWithAuthor,
): number => a.created_at.localeCompare(b.created_at);
