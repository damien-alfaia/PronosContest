import { z } from 'zod';

import { PHASE_VALUES } from '@/features/pronos/schemas';

/**
 * Schémas Zod pour l'admin côté matchs.
 *
 * Trois flux d'édition distincts :
 *   1. Assignation / changement d'équipes (phase KO : placeholder → qualifié)
 *   2. Saisie / correction du résultat (score_a / score_b + vainqueur_tab + pénos)
 *   3. Changement de statut (planifié / live / fini / reporté / annulé)
 *
 * Chaque schéma est indépendant pour coller à l'UX : on propose des
 * actions ciblées plutôt qu'une grosse form qui mélange tout.
 *
 * Les messages d'erreur sont des clés i18n résolues côté UI.
 */

// ------------------------------------------------------------------
//  STATUS
// ------------------------------------------------------------------

/** Statuts acceptés par le CHECK SQL (voir migration Sprint 5.A). */
export const MATCH_STATUS_VALUES = [
  'scheduled',
  'live',
  'finished',
  'postponed',
  'cancelled',
] as const;
export type MatchStatus = (typeof MATCH_STATUS_VALUES)[number];

/** Statuts "hors jeu" : un match à reporter ou à annuler. */
export const TERMINAL_HIATUS_STATUSES: readonly MatchStatus[] = [
  'postponed',
  'cancelled',
] as const;

export const VAINQUEUR_TAB_VALUES = ['a', 'b'] as const;
export type VainqueurTab = (typeof VAINQUEUR_TAB_VALUES)[number];

// ------------------------------------------------------------------
//  1. Assignation d'équipes (matchs KO placeholder)
// ------------------------------------------------------------------

/**
 * Assignation d'équipes pour un match (typiquement phase KO seedée
 * avec des `null`). On accepte null pour pouvoir "dé-assigner" si on
 * s'est trompé (tant que le match n'est pas `finished` → le trigger
 * SQL bloque tout changement d'équipe sur un match terminé).
 */
export const assignMatchTeamsSchema = z
  .object({
    match_id: z.string().uuid({ message: 'admin.errors.matchRequired' }),
    equipe_a_id: z
      .string()
      .uuid({ message: 'admin.errors.equipeInvalid' })
      .nullable(),
    equipe_b_id: z
      .string()
      .uuid({ message: 'admin.errors.equipeInvalid' })
      .nullable(),
  })
  .refine(
    (data) =>
      data.equipe_a_id === null ||
      data.equipe_b_id === null ||
      data.equipe_a_id !== data.equipe_b_id,
    {
      path: ['equipe_b_id'],
      message: 'admin.errors.equipesMustDiffer',
    },
  );

export type AssignMatchTeamsInput = z.infer<typeof assignMatchTeamsSchema>;

// ------------------------------------------------------------------
//  2. Résultat du match
// ------------------------------------------------------------------

/**
 * Helper : une phase KO accepte un `vainqueur_tab` en cas d'égalité
 * et interdit toute égalité non départagée.
 */
const isKoPhase = (phase: (typeof PHASE_VALUES)[number]): boolean =>
  phase !== 'groupes';

/**
 * Saisie du résultat.
 *
 * - `status` ciblé : 'finished' la plupart du temps (fin d'un match
 *   joué). On autorise aussi 'live' pour afficher un score en direct
 *   sans figer le scoring (v_pronos_points filtre sur is_final).
 * - Pénos : optionnels, bornés 0..30 (largement au-dessus des records
 *   observés). Ne sont utilisés que pour l'affichage public.
 * - `vainqueur_tab` : obligatoire si KO + égalité, interdit sinon.
 * - `phase` est fourni par le caller (connu côté UI via le match) et
 *   sert uniquement à valider la cohérence ; pas renvoyé en BDD.
 */
export const updateMatchResultSchema = z
  .object({
    match_id: z.string().uuid({ message: 'admin.errors.matchRequired' }),
    phase: z.enum(PHASE_VALUES),

    score_a: z
      .number({ message: 'admin.errors.scoreRequired' })
      .int({ message: 'admin.errors.scoreInteger' })
      .min(0, { message: 'admin.errors.scoreRange' })
      .max(99, { message: 'admin.errors.scoreRange' }),
    score_b: z
      .number({ message: 'admin.errors.scoreRequired' })
      .int({ message: 'admin.errors.scoreInteger' })
      .min(0, { message: 'admin.errors.scoreRange' })
      .max(99, { message: 'admin.errors.scoreRange' }),

    vainqueur_tab: z.enum(VAINQUEUR_TAB_VALUES).nullable().default(null),

    penalty_score_a: z
      .number()
      .int({ message: 'admin.errors.scoreInteger' })
      .min(0, { message: 'admin.errors.penaltyRange' })
      .max(30, { message: 'admin.errors.penaltyRange' })
      .nullable()
      .default(null),
    penalty_score_b: z
      .number()
      .int({ message: 'admin.errors.scoreInteger' })
      .min(0, { message: 'admin.errors.penaltyRange' })
      .max(30, { message: 'admin.errors.penaltyRange' })
      .nullable()
      .default(null),

    status: z.enum(['live', 'finished']),
  })
  .superRefine((data, ctx) => {
    const isDraw = data.score_a === data.score_b;
    const ko = isKoPhase(data.phase);

    if (!ko) {
      if (data.vainqueur_tab !== null) {
        ctx.addIssue({
          code: 'custom',
          path: ['vainqueur_tab'],
          message: 'admin.errors.vainqueurTabNotAllowedGroupes',
        });
      }
      return;
    }

    // Phase KO : le vainqueur doit être désigné si les scores sont égaux
    if (isDraw && data.vainqueur_tab === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['vainqueur_tab'],
        message: 'admin.errors.vainqueurTabRequiredOnDraw',
      });
    } else if (!isDraw && data.vainqueur_tab !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['vainqueur_tab'],
        message: 'admin.errors.vainqueurTabOnlyOnDraw',
      });
    }

    // Cohérence pénos : si un score de péno est renseigné, l'autre
    // doit l'être aussi (on n'accepte pas des pénos "unilatéraux").
    const aSet = data.penalty_score_a !== null;
    const bSet = data.penalty_score_b !== null;
    if (aSet !== bSet) {
      ctx.addIssue({
        code: 'custom',
        path: ['penalty_score_b'],
        message: 'admin.errors.penaltyBothOrNone',
      });
    }
  });

export type UpdateMatchResultInput = z.infer<typeof updateMatchResultSchema>;

// ------------------------------------------------------------------
//  3. Changement de statut simple (postponed / cancelled / scheduled)
// ------------------------------------------------------------------

/**
 * Changement de statut isolé — utile pour reporter ou annuler un match
 * sans toucher au score. Les statuts `live` / `finished` passent par
 * `updateMatchResultSchema` (qui exige un score).
 */
export const updateMatchStatusSchema = z.object({
  match_id: z.string().uuid({ message: 'admin.errors.matchRequired' }),
  status: z.enum(['scheduled', 'postponed', 'cancelled']),
});

export type UpdateMatchStatusInput = z.infer<typeof updateMatchStatusSchema>;
