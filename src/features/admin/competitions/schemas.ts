import { z } from 'zod';

/**
 * Schémas Zod pour le référentiel admin — côté compétitions.
 *
 * Alignés sur les contraintes SQL :
 *   - `code` : slug unique (a-z0-9-), on tolère 2-40 caractères.
 *   - `sport` : CHECK 'football' | 'rugby'.
 *   - `status` : CHECK 'upcoming' | 'live' | 'finished'.
 *   - `date_debut` / `date_fin` : optionnels, tous deux ou aucun.
 *   - CHECK SQL `competitions_dates_order` : date_fin >= date_debut
 *     quand les deux sont renseignées.
 *
 * Messages = clés i18n (résolution côté UI).
 */

export const SPORT_VALUES = ['football', 'rugby'] as const;
export type Sport = (typeof SPORT_VALUES)[number];

export const COMPETITION_STATUS_VALUES = [
  'upcoming',
  'live',
  'finished',
] as const;
export type CompetitionStatus = (typeof COMPETITION_STATUS_VALUES)[number];

/**
 * Forme d'entrée d'un date-picker HTML (`<input type="date" />` renvoie
 * une string `YYYY-MM-DD` ou "" si vide). On normalise vers `string | null`.
 */
const dateFieldSchema = z.preprocess(
  (val) => {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      return trimmed === '' ? null : trimmed;
    }
    return val;
  },
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'admin.errors.dateFormat' })
    .nullable(),
);

/**
 * Schéma de base (création + édition partagent le même payload applicatif).
 *
 * `code` est unique mais on ne peut pas le vérifier côté Zod — l'erreur
 * 23505 de Supabase est mappée côté mutation vers un toast dédié.
 */
export const competitionUpsertSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, { message: 'admin.errors.codeTooShort' })
      .max(40, { message: 'admin.errors.codeTooLong' })
      .regex(/^[a-z0-9-]+$/, { message: 'admin.errors.codeSlugFormat' }),
    nom: z
      .string()
      .trim()
      .min(2, { message: 'admin.errors.nomTooShort' })
      .max(120, { message: 'admin.errors.nomTooLong' }),
    sport: z.enum(SPORT_VALUES, { message: 'admin.errors.sportRequired' }),
    status: z.enum(COMPETITION_STATUS_VALUES, {
      message: 'admin.errors.statusRequired',
    }),
    date_debut: dateFieldSchema,
    date_fin: dateFieldSchema,
    logo_url: z.preprocess(
      (val) => {
        if (val === undefined || val === null) return null;
        if (typeof val === 'string') {
          const trimmed = val.trim();
          return trimmed === '' ? null : trimmed;
        }
        return val;
      },
      z.string().url({ message: 'admin.errors.logoUrlFormat' }).nullable(),
    ),
  })
  .superRefine((data, ctx) => {
    // CHECK SQL `competitions_dates_order` en miroir côté client.
    if (
      data.date_debut !== null &&
      data.date_fin !== null &&
      data.date_fin < data.date_debut
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['date_fin'],
        message: 'admin.errors.dateFinBeforeDebut',
      });
    }
  });

export type CompetitionUpsertInput = z.infer<typeof competitionUpsertSchema>;

/**
 * Payload de création complète (applicatif = schéma).
 * Pour l'édition, on ajoute `id` côté api.
 */
export const competitionCreateSchema = competitionUpsertSchema;
export type CompetitionCreateInput = CompetitionUpsertInput;

export const competitionUpdateSchema = competitionUpsertSchema;
export type CompetitionUpdateInput = CompetitionUpsertInput;
