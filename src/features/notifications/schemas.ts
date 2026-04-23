import { z } from 'zod';

/**
 * Schémas Zod pour la feature notifications (Sprints 6.C + 8.C.4).
 *
 * La table `public.notifications` stocke des notifications in-app
 * alimentées exclusivement par des triggers SECURITY DEFINER :
 *
 *   - match_result         : match terminé dans une compétition où
 *                            l'user participe à au moins un concours
 *   - badge_earned         : nouveau badge décroché
 *   - concours_new_member  : un participant rejoint un concours dont
 *                            l'user est owner
 *   - chat_mention         : `@Prénom Nom` ou `@Prénom` dans le chat
 *   - challenge_received   : un user t'a challengé (challenge ou
 *                            double_down) sur un match donné
 *   - gift_received        : un user t'a offert un joker via `gift`
 *
 * Chaque type a une forme de `payload` (jsonb) bien définie par son
 * trigger SQL. Côté front on exprime ça via une **union discriminée**
 * sur le champ `type`, ce qui donne au consommateur l'auto-complétion
 * correcte sans besoin de narrowing manuel (`if type === 'match_result'`
 * → TS sait que `payload` est `MatchResultPayload`).
 *
 * Les libellés (title / body) sont intentionnellement nullables en
 * base : les triggers ne les remplissent pas, c'est le front qui
 * compose un titre localisé à partir de `type` + `payload` via i18n.
 * La porte reste ouverte à des notifs "admin broadcast" futures qui
 * rempliraient title/body en dur.
 */

// ------------------------------------------------------------------
//  ENUMS
// ------------------------------------------------------------------

export const NOTIFICATION_TYPE_VALUES = [
  'match_result',
  'badge_earned',
  'concours_new_member',
  'chat_mention',
  'challenge_received',
  'gift_received',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPE_VALUES)[number];

export const CHAT_MENTION_MATCH_TYPES = ['full_name', 'first_name'] as const;
export type ChatMentionMatchType = (typeof CHAT_MENTION_MATCH_TYPES)[number];

/**
 * Codes de joker transportés dans les payloads de notifications sociales
 * (`challenge_received`, `gift_received`). On reste volontairement
 * permissif au niveau TypeScript (`string`) : la valeur fait partie du
 * catalogue SQL et l'UI sait déjà afficher le libellé via i18n. On
 * n'introduit pas ici d'enum fermé pour ne pas ré-imposer une liste
 * figée à chaque ajout de joker.
 */
export const CHALLENGE_JOKER_CODES = ['challenge', 'double_down'] as const;
export type ChallengeJokerCode = (typeof CHALLENGE_JOKER_CODES)[number];

// ------------------------------------------------------------------
//  PAYLOADS (une forme par `type`)
// ------------------------------------------------------------------

/**
 * Payload `match_result` — produit par le trigger
 * `handle_notifications_on_match_finished`. Tous les champs de score
 * sont nullables au niveau du type : un admin peut en théorie forcer
 * le passage à `finished` sans score (le trigger guard alors et ne
 * pousse rien, mais la défense en profondeur côté front ne coûte rien).
 */
export const matchResultPayloadSchema = z.object({
  match_id: z.string().uuid(),
  competition_id: z.string().uuid(),
  score_a: z.number().int().nullable(),
  score_b: z.number().int().nullable(),
  equipe_a_id: z.string().uuid().nullable(),
  equipe_b_id: z.string().uuid().nullable(),
  vainqueur_tab: z.enum(['a', 'b']).nullable(),
});
export type MatchResultPayload = z.infer<typeof matchResultPayloadSchema>;

/**
 * Payload `badge_earned` — produit par le trigger
 * `handle_notifications_on_badge_earned`. `metadata` reste libre
 * (jsonb brut) : certaines attributions y stockent des compteurs
 * (ex : `{count: 50}` pour le badge centurion).
 */
export const badgeEarnedPayloadSchema = z.object({
  badge_code: z.string().min(1),
  earned_at: z.string(), // ISO-8601
  metadata: z.record(z.string(), z.unknown()),
});
export type BadgeEarnedPayload = z.infer<typeof badgeEarnedPayloadSchema>;

/**
 * Payload `concours_new_member` — produit par le trigger
 * `handle_notifications_on_participant_joined`. Le nom du concours est
 * matérialisé dans le payload pour que la notif reste lisible même si
 * le concours est renommé ou supprimé ultérieurement.
 */
export const concoursNewMemberPayloadSchema = z.object({
  concours_id: z.string().uuid(),
  concours_nom: z.string().min(1),
  new_user_id: z.string().uuid(),
});
export type ConcoursNewMemberPayload = z.infer<
  typeof concoursNewMemberPayloadSchema
>;

/**
 * Payload `chat_mention` — produit par le trigger
 * `handle_notifications_on_chat_mention`. `match_type` distingue :
 *   - `full_name`   : mention explicite `@Prénom Nom` (sans ambiguïté).
 *   - `first_name`  : mention `@Prénom` quand le prénom était unique
 *                     parmi les participants du concours.
 * Le front peut s'en servir pour différencier la présentation (ex :
 * préfixer le rendu de la mention par le nom complet pour `first_name`
 * afin de lever le doute chez le destinataire).
 */
export const chatMentionPayloadSchema = z.object({
  concours_id: z.string().uuid(),
  message_id: z.string().uuid(),
  mentioned_by: z.string().uuid(),
  token: z.string().min(1),
  match_type: z.enum(CHAT_MENTION_MATCH_TYPES),
  body_preview: z.string(),
});
export type ChatMentionPayload = z.infer<typeof chatMentionPayloadSchema>;

/**
 * Payload `challenge_received` — produit par le trigger
 * `handle_notifications_on_joker_consumed` (Sprint 8.C.4) quand un user
 * consomme un joker de catégorie `challenge` (`challenge` ou
 * `double_down`) en te ciblant sur un match précis. `stakes` reproduit
 * en payload la valeur numérique convenue par le RPC (5 pour challenge,
 * 10 pour double_down) → l'UI peut afficher "il risque 5 pts" ou
 * "10 pts" sans re-lookup du catalogue.
 */
export const challengeReceivedPayloadSchema = z.object({
  concours_id: z.string().uuid(),
  match_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  joker_code: z.string().min(1),
  stakes: z.number().int().nonnegative().nullable(),
});
export type ChallengeReceivedPayload = z.infer<
  typeof challengeReceivedPayloadSchema
>;

/**
 * Payload `gift_received` — produit par le trigger
 * `handle_notifications_on_joker_consumed` (Sprint 8.C.4) quand un user
 * consomme son slot `gift` en ton nom. Le slot offert est déjà présent
 * dans ton inventaire au moment où tu reçois la notif (INSERT
 * `acquired_from = 'gift'` fait en amont dans le RPC `use_joker`) : il
 * n'y a donc pas d'action utilisateur à dérouler, la notif est purement
 * informative.
 */
export const giftReceivedPayloadSchema = z.object({
  concours_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  gifted_joker_code: z.string().min(1),
});
export type GiftReceivedPayload = z.infer<typeof giftReceivedPayloadSchema>;

// ------------------------------------------------------------------
//  ROW (union discriminée par `type`)
// ------------------------------------------------------------------

/**
 * Champs communs à toutes les notifications (colonnes plates de la
 * table). Factorisés ici pour rester DRY lors de la construction de
 * l'union discriminée.
 */
const notificationBaseShape = {
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string().nullable(),
  body: z.string().nullable(),
  read_at: z.string().nullable(),
  created_at: z.string(),
};

export const notificationSchema = z.discriminatedUnion('type', [
  z.object({
    ...notificationBaseShape,
    type: z.literal('match_result'),
    payload: matchResultPayloadSchema,
  }),
  z.object({
    ...notificationBaseShape,
    type: z.literal('badge_earned'),
    payload: badgeEarnedPayloadSchema,
  }),
  z.object({
    ...notificationBaseShape,
    type: z.literal('concours_new_member'),
    payload: concoursNewMemberPayloadSchema,
  }),
  z.object({
    ...notificationBaseShape,
    type: z.literal('chat_mention'),
    payload: chatMentionPayloadSchema,
  }),
  z.object({
    ...notificationBaseShape,
    type: z.literal('challenge_received'),
    payload: challengeReceivedPayloadSchema,
  }),
  z.object({
    ...notificationBaseShape,
    type: z.literal('gift_received'),
    payload: giftReceivedPayloadSchema,
  }),
]);
export type Notification = z.infer<typeof notificationSchema>;

// Variantes "typées" exportées pour ergonomie côté UI.
export type MatchResultNotification = Notification & { type: 'match_result' };
export type BadgeEarnedNotification = Notification & { type: 'badge_earned' };
export type ConcoursNewMemberNotification = Notification & {
  type: 'concours_new_member';
};
export type ChatMentionNotification = Notification & { type: 'chat_mention' };
export type ChallengeReceivedNotification = Notification & {
  type: 'challenge_received';
};
export type GiftReceivedNotification = Notification & {
  type: 'gift_received';
};

// ------------------------------------------------------------------
//  NORMALIZER
// ------------------------------------------------------------------

/**
 * Coerce une ligne brute de `notifications` (colonnes jsonb/nullables)
 * en `Notification` strictement typée.
 *
 * Retourne `null` si :
 *   - une colonne obligatoire manque (id / user_id / type / created_at),
 *   - `type` n'est pas dans l'enum attendu (mauvais seed, rétro-compat
 *     cassée suite à un renommage de type sans migration des rows),
 *   - `payload` n'est pas un objet ou viole le schéma du type considéré.
 *
 * Cette défensivité évite qu'une notif mal formée fasse planter la
 * pop-up cloche : on la laisse tomber silencieusement et on continue.
 */
export const normalizeNotification = (raw: {
  id: string | null;
  user_id: string | null;
  type: string | null;
  title: string | null;
  body: string | null;
  payload: unknown;
  read_at: string | null;
  created_at: string | null;
}): Notification | null => {
  if (!raw.id || !raw.user_id || !raw.type || !raw.created_at) return null;

  const payload =
    typeof raw.payload === 'object' &&
    raw.payload !== null &&
    !Array.isArray(raw.payload)
      ? (raw.payload as Record<string, unknown>)
      : {};

  const candidate = {
    id: raw.id,
    user_id: raw.user_id,
    type: raw.type,
    title: raw.title,
    body: raw.body,
    payload,
    read_at: raw.read_at,
    created_at: raw.created_at,
  };

  const parsed = notificationSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
};

// ------------------------------------------------------------------
//  HELPERS UI
// ------------------------------------------------------------------

/**
 * Tri canonique pour la liste de notifications :
 * plus récente en premier (created_at descendant).
 * Tie-breaker par `id` pour un ordre stable si 2 notifs partagent
 * le même `created_at` (possible quand un trigger en pousse plusieurs
 * dans la même transaction).
 */
export const compareNotificationByRecent = (
  a: Notification,
  b: Notification,
): number => {
  const byDate = b.created_at.localeCompare(a.created_at);
  if (byDate !== 0) return byDate;
  return b.id.localeCompare(a.id);
};

/** `true` si la notification est toujours non lue. */
export const isUnread = (n: Notification): boolean => n.read_at === null;
