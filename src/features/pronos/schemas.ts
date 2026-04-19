import { z } from 'zod';

/**
 * Schémas Zod pour la feature pronos.
 *
 * Rappel des règles métier :
 *  - Un prono est composé de `score_a` / `score_b` (0..99, entiers).
 *  - `vainqueur_tab` ('a' | 'b') sert à départager une égalité
 *    sur un match KO. Il doit donc :
 *      - être `null` en phase de groupes (égalité autorisée),
 *      - être `null` si scores différents,
 *      - être renseigné si phase KO ET scores égaux.
 *
 * La phase d'un match n'est pas stockée sur le prono : on la reçoit
 * en entrée du schéma (via le match référencé) pour valider le tout
 * en une passe.
 *
 * Les messages d'erreur sont des clés i18n résolues côté UI.
 */

/** Valeurs possibles de `matchs.phase` (CHECK SQL). */
export const PHASE_VALUES = [
  'groupes',
  'seiziemes',
  'huitiemes',
  'quarts',
  'demis',
  'petite_finale',
  'finale',
] as const;
export type MatchPhase = (typeof PHASE_VALUES)[number];

/** Phases à élimination directe : une égalité y est impossible sans départage. */
export const KO_PHASES: readonly MatchPhase[] = PHASE_VALUES.filter(
  (p) => p !== 'groupes',
);

export const VAINQUEUR_TAB_VALUES = ['a', 'b'] as const;
export type VainqueurTab = (typeof VAINQUEUR_TAB_VALUES)[number];

export const isKoPhase = (phase: MatchPhase): boolean => phase !== 'groupes';

// ------------------------------------------------------------------
//  SCHÉMAS
// ------------------------------------------------------------------

/**
 * Schéma d'un score brut (sans règles de cohérence entre champs).
 * Sert de base pour les formulaires et les mutations.
 */
const pronoScoreSchema = z.object({
  score_a: z
    .number({ message: 'pronos.errors.scoreRequired' })
    .int({ message: 'pronos.errors.scoreInteger' })
    .min(0, { message: 'pronos.errors.scoreRange' })
    .max(99, { message: 'pronos.errors.scoreRange' }),
  score_b: z
    .number({ message: 'pronos.errors.scoreRequired' })
    .int({ message: 'pronos.errors.scoreInteger' })
    .min(0, { message: 'pronos.errors.scoreRange' })
    .max(99, { message: 'pronos.errors.scoreRange' }),
  vainqueur_tab: z.enum(VAINQUEUR_TAB_VALUES).nullable().default(null),
});

/**
 * Valide la cohérence `vainqueur_tab` vs `phase` + scores égaux/différents.
 * À appliquer sur chaque input qui connaît la phase du match.
 */
const refineVainqueurTab = <T extends { score_a: number; score_b: number; vainqueur_tab: VainqueurTab | null; phase: MatchPhase }>(
  data: T,
  ctx: z.RefinementCtx,
): void => {
  const isDraw = data.score_a === data.score_b;
  const ko = isKoPhase(data.phase);

  if (!ko) {
    // Phase de groupes : vainqueur_tab doit être null
    if (data.vainqueur_tab !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['vainqueur_tab'],
        message: 'pronos.errors.vainqueurTabNotAllowedGroupes',
      });
    }
    return;
  }

  // Phase KO
  if (isDraw && data.vainqueur_tab === null) {
    ctx.addIssue({
      code: 'custom',
      path: ['vainqueur_tab'],
      message: 'pronos.errors.vainqueurTabRequiredOnDraw',
    });
  } else if (!isDraw && data.vainqueur_tab !== null) {
    ctx.addIssue({
      code: 'custom',
      path: ['vainqueur_tab'],
      message: 'pronos.errors.vainqueurTabOnlyOnDraw',
    });
  }
};

/**
 * Input de formulaire : juste les scores + départage + la phase
 * (pour valider la cohérence).
 *
 * Utilisé dans `MatchCard` via react-hook-form.
 */
export const pronoFormSchema = pronoScoreSchema
  .extend({
    phase: z.enum(PHASE_VALUES),
  })
  .superRefine((data, ctx) => refineVainqueurTab(data, ctx));

export type PronoFormInput = z.infer<typeof pronoFormSchema>;

/**
 * Input de mutation : identique au form + les ids de lien.
 * Utilisé par la couche api / hooks.
 */
export const upsertPronoSchema = pronoScoreSchema
  .extend({
    concours_id: z.string().uuid({ message: 'pronos.errors.concoursRequired' }),
    match_id: z.string().uuid({ message: 'pronos.errors.matchRequired' }),
    phase: z.enum(PHASE_VALUES),
  })
  .superRefine((data, ctx) => refineVainqueurTab(data, ctx));

export type UpsertPronoInput = z.infer<typeof upsertPronoSchema>;

/**
 * Input de suppression (idempotent côté api).
 */
export const deletePronoSchema = z.object({
  concours_id: z.string().uuid({ message: 'pronos.errors.concoursRequired' }),
  match_id: z.string().uuid({ message: 'pronos.errors.matchRequired' }),
});

export type DeletePronoInput = z.infer<typeof deletePronoSchema>;
