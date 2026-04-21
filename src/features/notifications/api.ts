import { supabase } from '@/lib/supabase';

import { type Notification, normalizeNotification } from './schemas';

/**
 * Couche API de la feature notifications (Sprint 6.C).
 *
 * Règles RLS côté SQL :
 *   - SELECT : self uniquement (`user_id = auth.uid()`).
 *   - UPDATE : self uniquement, mais un trigger BEFORE UPDATE
 *     `notifications_prevent_content_update` restaure toutes les
 *     colonnes sauf `read_at` depuis OLD. Le front NE PEUT DONC PAS
 *     réécrire title / body / payload — seul `read_at` est mutable.
 *   - INSERT / DELETE : aucune policy. L'écriture passe exclusivement
 *     par les 4 triggers SECURITY DEFINER (match terminé, badge gagné,
 *     nouveau membre, mention chat).
 *
 * Convention select :
 *   - colonnes explicites (pas de `select('*')`) pour rester robuste
 *     à l'ajout futur de colonnes côté SQL,
 *   - tri `created_at desc` côté SQL (index dédié
 *     `notifications_user_created_idx`),
 *   - le front garde cet ordre tel quel (plus récent en premier) —
 *     contrairement au chat, pas de reverse, c'est l'UX classique
 *     d'un centre de notifications.
 *
 * Les erreurs Supabase sont propagées telles quelles ; l'UI les
 * mappe ensuite via i18n (`notifications.errors.*`).
 */

// ------------------------------------------------------------------
//  CONSTANTES
// ------------------------------------------------------------------

/**
 * Taille de page par défaut. Dimensionné petit : la pop-up cloche
 * n'affiche qu'une vingtaine de lignes avant de proposer "Charger
 * plus" ; les scroll longs sont rarissimes côté produit.
 */
export const DEFAULT_PAGE_SIZE = 20;

// ------------------------------------------------------------------
//  LISTE (pagination cursor `before=created_at`)
// ------------------------------------------------------------------

/**
 * Liste paginée des notifications d'un user.
 *
 * - `before` : ISO string d'un `created_at` déjà vu. On retourne les
 *   notifs strictement antérieures, pour une pagination "Charger plus"
 *   sans risque de décalage si de nouvelles notifs arrivent en tête.
 * - `limit` : nombre max (défaut 20).
 *
 * Résultat : `Notification[]` trié DESC (plus récent en premier). Les
 * lignes invalides (type inconnu, payload non conforme) sont filtrées
 * silencieusement par le normalizer pour ne pas bloquer l'UI.
 */
export const listNotifications = async (
  userId: string,
  options: { before?: string; limit?: number } = {},
): Promise<Notification[]> => {
  const { before, limit = DEFAULT_PAGE_SIZE } = options;

  let query = supabase
    .from('notifications')
    .select('id, user_id, type, title, body, payload, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data) return [];

  return data
    .map(normalizeNotification)
    .filter((n): n is Notification => n !== null);
};

// ------------------------------------------------------------------
//  COMPTEUR NON-LUES (pour le badge de la cloche)
// ------------------------------------------------------------------

/**
 * Compte les notifications non-lues d'un user.
 *
 * Utilise l'index partiel `notifications_user_unread_idx` côté SQL
 * (`where read_at is null`) : le COUNT est ultra-léger même sur
 * des volumes importants. `head: true` évite de rapatrier les lignes.
 */
export const countUnreadNotifications = async (
  userId: string,
): Promise<number> => {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
  return count ?? 0;
};

// ------------------------------------------------------------------
//  MARQUER COMME LUE
// ------------------------------------------------------------------

/**
 * Marque une notification comme lue (set `read_at = now()` côté client).
 *
 * Pourquoi pas `now()` côté SQL ? parce que l'UPDATE passe par la
 * policy `notifications_update_self` + le trigger de restauration
 * column-level : on envoie explicitement `read_at` comme nouvelle
 * valeur, le reste est restauré par le trigger. Un `now()` côté SQL
 * aurait demandé un RPC dédié.
 *
 * Idempotent grâce au filtre `.is('read_at', null)` : si la notif
 * est déjà lue, l'UPDATE touche 0 ligne sans erreur.
 */
export const markNotificationAsRead = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);

  if (error) throw error;
};

/**
 * Marque toutes les notifications non-lues d'un user comme lues.
 * Utilisé par le bouton "Tout marquer comme lu" dans la pop-up cloche.
 *
 * On fixe `read_at` côté client (timestamp identique pour tout le
 * batch). Idempotent : le filtre `.is('read_at', null)` exclut
 * naturellement les notifs déjà lues.
 */
export const markAllNotificationsAsRead = async (
  userId: string,
): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
};

// ------------------------------------------------------------------
//  GET ONE (utilisé par le Realtime pour enrichir un payload INSERT)
// ------------------------------------------------------------------

/**
 * Récupère une notification unique. Le Realtime pourrait en théorie
 * suffire (le payload INSERT contient toutes les colonnes), mais on
 * passe par un fetch dédié pour :
 *   - traverser exactement la même RLS / normalisation que la liste,
 *   - éviter de dépendre du format exact du payload Realtime qui a
 *     évolué entre versions majeures de supabase-js.
 *
 * Retourne `null` si la notif n'existe plus (rare : pas de DELETE
 * côté client, mais cascade possible sur `auth.users`).
 */
export const getNotificationById = async (
  id: string,
): Promise<Notification | null> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, type, title, body, payload, read_at, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return normalizeNotification(data);
};
