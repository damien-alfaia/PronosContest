import { z } from 'zod';

/**
 * Schémas Zod pour la feature concours.
 *
 * Les messages d'erreur sont des clés i18n résolues côté UI.
 * La validation de `scoring_rules` reste simple ici : on vérifie
 * la forme, le CHECK SQL vérifie juste `jsonb_typeof = 'object'`.
 */

/** Valeurs de visibility — doivent matcher le CHECK SQL. */
export const VISIBILITY_VALUES = ['public', 'private', 'unlisted'] as const;
export type Visibility = (typeof VISIBILITY_VALUES)[number];

/** Défauts de scoring (alignés sur le DEFAULT de la colonne SQL). */
export const DEFAULT_SCORING_RULES = {
  exact_score: 15,
  correct_winner: 5,
  correct_draw: 7,
  odds_multiplier_enabled: true,
  knockout_bonus: 2,
} as const;

/**
 * Schéma des règles de scoring.
 * On garde des bornes larges, la config fine sera admin.
 */
export const scoringRulesSchema = z.object({
  exact_score: z.number().int().min(0).max(100),
  correct_winner: z.number().int().min(0).max(100),
  correct_draw: z.number().int().min(0).max(100),
  odds_multiplier_enabled: z.boolean(),
  knockout_bonus: z.number().int().min(0).max(100),
});

export type ScoringRules = z.infer<typeof scoringRulesSchema>;

/**
 * Création d'un concours.
 * - nom 3-80 (contrainte SQL char_length)
 * - description optionnelle, max 500 (contrainte SQL)
 * - code_invitation jamais saisi côté front : généré par trigger SQL
 */
export const concoursCreateSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(3, { message: 'concours.errors.nomTooShort' })
    .max(80, { message: 'concours.errors.nomTooLong' }),
  // Description optionnelle : on mappe "" -> undefined (preprocess) puis
  // on valide la taille max. Permet de laisser le champ vide côté form
  // sans déclencher une contrainte inutile.
  description: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z
      .string()
      .trim()
      .max(500, { message: 'concours.errors.descriptionTooLong' })
      .optional(),
  ),
  competition_id: z
    .string()
    .uuid({ message: 'concours.errors.competitionRequired' }),
  visibility: z.enum(VISIBILITY_VALUES, {
    message: 'concours.errors.visibilityRequired',
  }),
  scoring_rules: scoringRulesSchema.default(DEFAULT_SCORING_RULES),
});

export type ConcoursCreateInput = z.infer<typeof concoursCreateSchema>;

/**
 * Saisie d'un code d'invitation.
 * Format SQL : 8 caractères hex uppercase. On accepte 6-12 pour
 * rester robuste à un futur changement sans casser les anciens codes.
 */
export const joinByCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(6, { message: 'concours.errors.codeTooShort' })
    .max(12, { message: 'concours.errors.codeTooLong' })
    .transform((value) => value.toUpperCase()),
});

export type JoinByCodeInput = z.infer<typeof joinByCodeSchema>;

/**
 * Recherche de concours publics (texte libre).
 * On trim, on autorise vide = "tout lister".
 */
export const concoursSearchSchema = z.object({
  q: z.string().trim().max(80).optional(),
});

export type ConcoursSearchInput = z.infer<typeof concoursSearchSchema>;
