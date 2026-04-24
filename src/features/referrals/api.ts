import { supabase } from '@/lib/supabase';

/**
 * API referrals — viral loop Sprint 9.C.
 *
 * Responsabilités :
 *   - Construire l'URL d'invitation (landing `?intent=join&code=<C>&ref=<U>`)
 *     que l'ambassadeur partage à ses amis.
 *   - Lire le compteur d'invités déjà convertis pour un user (utilisé
 *     par `<ReferralBanner />` pour afficher "2 / 3 vers ton prochain
 *     joker").
 *
 * La logique de récompense vit côté DB (trigger `handle_referral_milestone`
 * ajouté par `20260503120000_referrals.sql`) : tous les 3 invités qui
 * rejoignent, l'ambassadeur reçoit 1 joker `double` + une notification.
 */

// ------------------------------------------------------------------
//  Construction du lien d'invitation
// ------------------------------------------------------------------

/**
 * Construit une URL absolue vers la landing avec intent=join +
 * code d'invitation pré-rempli + referrer_id tracé.
 *
 * La landing a un CTA `?intent=join` qui oriente le signup. Le champ
 * code est lu en sessionStorage depuis l'URL au premier hit (Sprint 9.B.3).
 * On passe aussi `ref=<uuid>` pour que le trigger milestone attribue
 * l'invité à l'ambassadeur.
 *
 * Note : l'origine est extraite de `window.location` (pas hardcodée)
 * pour supporter les previews Vercel / staging / localhost sans conf.
 */
export function buildReferralUrl(
  code: string,
  referrerId: string,
  origin?: string,
): string {
  const base =
    origin ??
    (typeof window !== 'undefined' ? window.location.origin : 'https://pronoscontest.app');
  const params = new URLSearchParams({
    intent: 'join',
    code: code.trim().toUpperCase(),
    ref: referrerId,
  });
  return `${base}/auth/signup?${params.toString()}`;
}

// ------------------------------------------------------------------
//  Count des invités convertis
// ------------------------------------------------------------------

/**
 * Compte le nombre total d'invités rejoignants, tous concours
 * confondus (la promesse milestone est "3 invités = joker", pas
 * "3 par concours").
 *
 * Utilise `count: 'exact', head: true` pour un COUNT(*) léger qui
 * ne rapatrie aucune ligne (sert juste la barre de progression).
 *
 * RLS : la policy SELECT sur `concours_participants` restreint déjà
 * aux participants partageant un concours. `count` avec `referrer_id
 * = userId` passe naturellement parce que l'user est forcément dans
 * le concours où il a invité.
 */
export async function countMyReferrals(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('concours_participants')
    .select('user_id', { count: 'exact', head: true })
    .eq('referrer_id', userId);

  if (error) throw error;
  return count ?? 0;
}
