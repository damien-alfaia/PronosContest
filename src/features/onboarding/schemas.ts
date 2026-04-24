import { z } from 'zod';

/**
 * Schémas Zod pour la feature onboarding.
 *
 * Source : table `public.user_onboarding_progress` (migration Sprint 9.A.1
 * `20260501120000_onboarding_progress.sql`). 1 ligne par user, créée
 * automatiquement par trigger à la création du profil.
 *
 * Tous les timestamps sont nullables (null = milestone pas encore atteinte).
 * `tour_steps_completed` est un jsonb garanti array par CHECK SQL.
 */

export const TOUR_STEP_IDS = [
  'pronos.first_match_card',
  'pronos.filters',
  'pronos.classement_cta',
] as const;

export type TourStepId = (typeof TOUR_STEP_IDS)[number];

export const onboardingProgressRowSchema = z.object({
  user_id: z.string().uuid(),
  welcomed_at: z.string().nullable(),
  first_concours_joined_at: z.string().nullable(),
  first_prono_saved_at: z.string().nullable(),
  first_classement_viewed_at: z.string().nullable(),
  first_invite_sent_at: z.string().nullable(),
  tour_steps_completed: z.array(z.string()).default([]),
  checklist_dismissed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type OnboardingProgressRow = z.infer<
  typeof onboardingProgressRowSchema
>;

/**
 * Normalise une ligne brute renvoyée par Supabase.
 * Retourne `null` si `user_id` est absent (défense en profondeur), sinon
 * coalesce `tour_steps_completed` non-array en `[]` et passe le reste via
 * le schéma Zod.
 */
export function normalizeOnboardingProgressRow(
  raw: unknown,
): OnboardingProgressRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (!obj.user_id) return null;

  // Défense : si jsonb revient non-array (fun fact Supabase), on force []
  const steps = Array.isArray(obj.tour_steps_completed)
    ? obj.tour_steps_completed
    : [];

  const parsed = onboardingProgressRowSchema.safeParse({
    ...obj,
    tour_steps_completed: steps,
  });
  return parsed.success ? parsed.data : null;
}

/**
 * Aggregate de milestones utilisé par la checklist + le WelcomeHero.
 * Dérivé pur de la ligne DB + de quelques champs du profil (prenom/nom/avatar).
 */
export interface OnboardingMilestones {
  welcomed: boolean;
  firstConcoursJoined: boolean;
  firstPronoSaved: boolean;
  firstClassementViewed: boolean;
  firstInviteSent: boolean;
  profileCompleted: boolean; // prenom + nom non vides (+ avatar_url optionnel)
  checklistDismissed: boolean;
  tourStepsCompleted: ReadonlyArray<string>;
}

export function computeMilestones(
  row: OnboardingProgressRow | null,
  profile: { prenom?: string | null; nom?: string | null } | null,
): OnboardingMilestones {
  return {
    welcomed: Boolean(row?.welcomed_at),
    firstConcoursJoined: Boolean(row?.first_concours_joined_at),
    firstPronoSaved: Boolean(row?.first_prono_saved_at),
    firstClassementViewed: Boolean(row?.first_classement_viewed_at),
    firstInviteSent: Boolean(row?.first_invite_sent_at),
    profileCompleted: Boolean(
      profile?.prenom &&
        profile.prenom.trim().length > 0 &&
        profile?.nom &&
        profile.nom.trim().length > 0,
    ),
    checklistDismissed: Boolean(row?.checklist_dismissed_at),
    tourStepsCompleted: row?.tour_steps_completed ?? [],
  };
}

/**
 * Compte les tâches complétées pour la barre de progression de la checklist.
 * 5 tâches : join / prono / classement / profile / invite.
 * (welcomed n'est pas dans la checklist — c'est le déclencheur initial.)
 */
export function checklistProgress(m: OnboardingMilestones): {
  done: number;
  total: number;
} {
  const done =
    Number(m.firstConcoursJoined) +
    Number(m.firstPronoSaved) +
    Number(m.firstClassementViewed) +
    Number(m.profileCompleted) +
    Number(m.firstInviteSent);
  return { done, total: 5 };
}
