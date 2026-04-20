import { z } from 'zod';

/**
 * Schémas Zod pour le référentiel admin — côté équipes.
 *
 * Contraintes SQL rappel (migration `init_concours.sql` + Sprint 5.B) :
 *   - `competition_id` UUID référencant `competitions.id`.
 *   - `code` unique par compétition (contrainte
 *     `equipes_code_per_competition`). Conventionnellement 3 lettres
 *     FIFA en majuscules (FRA, GER, ...), mais on tolère 2-10 pour
 *     rester souple (certains codes rugby sont en 2).
 *   - `nom` obligatoire.
 *   - `groupe` : libre, conventionnellement 'A'-'L' ou null.
 *   - `drapeau_url` : URL optionnelle.
 *   - Trigger `equipes_prevent_competition_change` : `competition_id`
 *     verrouillé en UPDATE (on ne peut pas changer la compétition
 *     d'une équipe existante).
 */

/**
 * Base commune — utilisée pour les formulaires de création et d'édition.
 * `competition_id` est inclus : à la création il est saisi (ou figé par
 * la page), à l'édition il est ignoré par l'API (le trigger SQL le
 * verrouille de toute façon).
 */
export const equipeUpsertSchema = z.object({
  competition_id: z
    .string()
    .uuid({ message: 'admin.errors.competitionRequired' }),
  code: z
    .string()
    .trim()
    .min(2, { message: 'admin.errors.teamCodeTooShort' })
    .max(10, { message: 'admin.errors.teamCodeTooLong' })
    .regex(/^[A-Z0-9]+$/, { message: 'admin.errors.teamCodeFormat' }),
  nom: z
    .string()
    .trim()
    .min(2, { message: 'admin.errors.nomTooShort' })
    .max(80, { message: 'admin.errors.nomTooLong' }),
  groupe: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return null;
      if (typeof val === 'string') {
        const trimmed = val.trim();
        return trimmed === '' ? null : trimmed.toUpperCase();
      }
      return val;
    },
    z
      .string()
      .regex(/^[A-Z]$/, { message: 'admin.errors.groupeFormat' })
      .nullable(),
  ),
  drapeau_url: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return null;
      if (typeof val === 'string') {
        const trimmed = val.trim();
        return trimmed === '' ? null : trimmed;
      }
      return val;
    },
    z.string().url({ message: 'admin.errors.drapeauUrlFormat' }).nullable(),
  ),
  fifa_id: z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === '') return null;
      if (typeof val === 'string') {
        const n = Number(val);
        return Number.isFinite(n) ? n : val;
      }
      return val;
    },
    z
      .number()
      .int({ message: 'admin.errors.fifaIdInteger' })
      .min(1, { message: 'admin.errors.fifaIdRange' })
      .nullable(),
  ),
});

export type EquipeUpsertInput = z.infer<typeof equipeUpsertSchema>;

export const equipeCreateSchema = equipeUpsertSchema;
export type EquipeCreateInput = EquipeUpsertInput;

export const equipeUpdateSchema = equipeUpsertSchema;
export type EquipeUpdateInput = EquipeUpsertInput;
