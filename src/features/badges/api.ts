import { supabase } from '@/lib/supabase';

import {
  type BadgeCatalogRow,
  type UserBadgeWithCatalog,
  normalizeBadgeCatalogRow,
  normalizeUserBadgeWithCatalog,
} from './schemas';

/**
 * Couche API de la feature badges.
 *
 * Deux sources :
 *   - `badges` : catalogue immuable, lecture ouverte à tous les
 *     authentifiés (policy `badges_select_all`).
 *   - `user_badges` : lecture self OU même concours (policy
 *     `user_badges_select_self_or_same_concours`).
 *
 * Toute la partie INSERT/UPDATE/DELETE passe par les triggers
 * SECURITY DEFINER (aucune policy côté client) — donc côté front on
 * ne fait jamais d'écriture directe.
 *
 * Les colonnes jsonb (`libelle`, `description`, `metadata`) remontent
 * en `Json` dans les types générés : on les parse via Zod dans les
 * normalizers (`schemas.ts`) pour typer strictement côté UI.
 */

// ------------------------------------------------------------------
//  CATALOGUE
// ------------------------------------------------------------------

/**
 * Récupère les 28 badges du catalogue, triés par `sort_order` (ordre
 * de seed contrôlé côté SQL : lifecycle → volume → skill → ...).
 *
 * Volume fixe et lecture publique : c'est le parfait candidat pour un
 * `staleTime` long côté hook (1h). Si le seed bouge, `supabase db reset`
 * + refresh client suffisent.
 */
export const listBadgesCatalog = async (): Promise<BadgeCatalogRow[]> => {
  const { data, error } = await supabase
    .from('badges')
    .select('code, category, tier, libelle, description, icon, sort_order')
    .order('sort_order', { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .map(normalizeBadgeCatalogRow)
    .filter((row): row is BadgeCatalogRow => row !== null);
};

// ------------------------------------------------------------------
//  USER BADGES
// ------------------------------------------------------------------

/**
 * Récupère les badges gagnés par un user (self ou autre, RLS filtre),
 * jointurés avec le catalogue pour disposer du libellé / icône / tier
 * en une seule requête.
 *
 * Tri : `earned_at desc` pour afficher les plus récents en premier
 * côté UI. Le tri final par tier / sort_order est laissé aux composants
 * via `compareBadgeCatalog` / `compareUserBadgeByRecent` au besoin.
 *
 * Les lignes dont le join est invalide (badge supprimé, seed cassé…)
 * sont filtrées silencieusement pour ne pas faire planter la page
 * profil sur un détail.
 */
export const listUserBadges = async (
  userId: string,
): Promise<UserBadgeWithCatalog[]> => {
  const { data, error } = await supabase
    .from('user_badges')
    .select(
      `
        user_id,
        badge_code,
        earned_at,
        metadata,
        badge:badges (
          code,
          category,
          tier,
          libelle,
          description,
          icon,
          sort_order
        )
      `,
    )
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .map(normalizeUserBadgeWithCatalog)
    .filter((row): row is UserBadgeWithCatalog => row !== null);
};

/**
 * Compte uniquement le nombre de badges gagnés par un user.
 *
 * Sert aux compteurs globaux (header, widgets) sans rapatrier tout le
 * détail. `head: true` + `count: 'exact'` : Supabase ne retourne pas
 * les lignes, juste le total.
 */
export const countUserBadges = async (userId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('user_badges')
    .select('badge_code', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) throw error;
  return count ?? 0;
};
