import { z } from 'zod';

/**
 * Schéma d'édition du profil.
 *
 * - `prenom` / `nom` : requis (trimés).
 * - `locale` : code ISO court (fr, en).
 *
 * Les messages sont des clés i18n résolues côté UI.
 */
export const profileUpdateSchema = z.object({
  prenom: z
    .string()
    .trim()
    .min(1, { message: 'auth.errors.firstNameRequired' })
    .max(80),
  nom: z
    .string()
    .trim()
    .min(1, { message: 'auth.errors.lastNameRequired' })
    .max(80),
  locale: z.enum(['fr', 'en']),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
