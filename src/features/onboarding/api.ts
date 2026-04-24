import { supabase } from '@/lib/supabase';

import {
  normalizeOnboardingProgressRow,
  type OnboardingProgressRow,
  type TourStepId,
} from './schemas';

/**
 * Couche API de la feature onboarding.
 *
 * RLS self-only : toutes les lectures / écritures sont filtrées par
 * `auth.uid() = user_id` côté DB (policies définies dans la migration
 * `20260501120000_onboarding_progress.sql`). On passe `userId` en
 * paramètre pour éviter les surprises (pas de lecture implicite de
 * `auth.user()` côté front) et pour simplifier le mocking Vitest.
 *
 * Invariants :
 *   - La ligne est créée automatiquement par trigger à la création
 *     du profil (chain INSERT auth.users -> profiles -> uop). Le front
 *     se contente de `SELECT` + `UPDATE`.
 *   - Les milestones `first_xxx_at` sont *one-shot* : une fois défini,
 *     on n'écrase plus. Les mutations utilisent un filtre `is null`
 *     pour garantir l'idempotence côté DB (évite les races et les
 *     ré-déclenchements intempestifs).
 */

const TABLE = 'user_onboarding_progress';

// ------------------------------------------------------------------
//  Lecture
// ------------------------------------------------------------------

/**
 * Retourne la ligne de progression de l'utilisateur courant, ou `null`
 * si elle n'existe pas (cas transitoire pendant le trigger post-INSERT
 * profile — très rare). Le schéma Zod filtre les lignes malformées.
 */
export async function getMyOnboardingProgress(
  userId: string,
): Promise<OnboardingProgressRow | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      'user_id, welcomed_at, first_concours_joined_at, first_prono_saved_at, first_classement_viewed_at, first_invite_sent_at, tour_steps_completed, checklist_dismissed_at, created_at, updated_at',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return normalizeOnboardingProgressRow(data);
}

// ------------------------------------------------------------------
//  Mutations — milestones one-shot (filtre `is null`)
// ------------------------------------------------------------------

/**
 * Helper générique : passe un champ `first_xxx_at` de null → now() si
 * il est encore null. Idempotent.
 */
async function setMilestoneIfUnset(
  userId: string,
  column:
    | 'welcomed_at'
    | 'first_concours_joined_at'
    | 'first_prono_saved_at'
    | 'first_classement_viewed_at'
    | 'first_invite_sent_at',
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ [column]: new Date().toISOString() })
    .eq('user_id', userId)
    .is(column, null);

  if (error) throw error;
}

export const markWelcomed = (userId: string) =>
  setMilestoneIfUnset(userId, 'welcomed_at');

export const markFirstConcoursJoined = (userId: string) =>
  setMilestoneIfUnset(userId, 'first_concours_joined_at');

export const markFirstPronoSaved = (userId: string) =>
  setMilestoneIfUnset(userId, 'first_prono_saved_at');

export const markFirstClassementViewed = (userId: string) =>
  setMilestoneIfUnset(userId, 'first_classement_viewed_at');

export const markFirstInviteSent = (userId: string) =>
  setMilestoneIfUnset(userId, 'first_invite_sent_at');

// ------------------------------------------------------------------
//  Mutations — product tour steps
// ------------------------------------------------------------------

/**
 * Ajoute une étape au tableau `tour_steps_completed` si elle n'y est
 * pas déjà. Implémenté en 2 passes (read + write) parce que Postgres
 * `jsonb_array_append` ne dé-duplique pas. Le coût reste négligeable
 * (1 ligne, self-only, 1 round-trip).
 *
 * Pour un appel atomique sans read, on pourrait écrire un RPC dédié ;
 * ici le trade-off n'en vaut pas la peine (pas de contention attendue
 * sur une ligne self-only).
 */
export async function markTourStepCompleted(
  userId: string,
  stepId: TourStepId,
): Promise<void> {
  const current = await getMyOnboardingProgress(userId);
  const existing = current?.tour_steps_completed ?? [];
  if (existing.includes(stepId)) return; // idempotent

  const next = [...existing, stepId];
  const { error } = await supabase
    .from(TABLE)
    .update({ tour_steps_completed: next })
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Marque toutes les étapes du tour comme complétées d'un coup (Skip
 * tout). Idempotent.
 */
export async function skipTour(
  userId: string,
  stepIds: readonly TourStepId[],
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ tour_steps_completed: [...stepIds] })
    .eq('user_id', userId);

  if (error) throw error;
}

// ------------------------------------------------------------------
//  Mutations — checklist
// ------------------------------------------------------------------

/**
 * Ferme la checklist (updates `checklist_dismissed_at`). Idempotent
 * côté front (on ne fait pas de filtre `is null` ici, on accepte de
 * remettre à now() si l'user re-clique plusieurs fois).
 */
export async function dismissChecklist(userId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ checklist_dismissed_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Annule la fermeture de la checklist (la ré-affiche). Utile si on
 * ajoute un bouton "Réafficher la checklist" dans un menu plus tard.
 */
export async function restoreChecklist(userId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ checklist_dismissed_at: null })
    .eq('user_id', userId);

  if (error) throw error;
}
