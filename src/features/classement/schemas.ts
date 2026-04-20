import { z } from 'zod';

/**
 * Schémas Zod pour la feature classement.
 *
 * Les vues `v_classement_concours` et `v_pronos_points` ont des colonnes
 * générées par jointures / agrégats : Postgres les remonte donc comme
 * `nullable` dans les types générés par Supabase. En réalité, à chaque
 * fois que l'on consomme la vue filtrée sur `concours_id`, on a :
 *   - concours_id / user_id toujours présents (PK logique),
 *   - points / pronos_* jamais null (coalesce côté vue),
 *   - rang jamais null (RANK() fenêtré est toujours défini).
 *
 * On utilise Zod pour :
 *   1) Valider ce contrat au runtime (sentinelle contre un re-gen
 *      de la vue qui casserait le front).
 *   2) Produire un type "strict" (non nullable) consommable par la UI
 *      sans test `row.points ?? 0` partout.
 */

// ------------------------------------------------------------------
//  CLASSEMENT ROW (1 ligne par participant d'un concours)
// ------------------------------------------------------------------

/**
 * Forme stricte d'une ligne de classement après normalisation.
 *
 * `prenom` / `nom` / `avatar_url` restent nullable :
 *   - un profil peut exister sans avoir rempli prenom / nom,
 *   - l'avatar est optionnel.
 */
export const classementRowSchema = z.object({
  concours_id: z.string().uuid(),
  user_id: z.string().uuid(),
  rang: z.number().int().min(1),
  points: z.number().int().min(0),
  pronos_joues: z.number().int().min(0),
  pronos_gagnes: z.number().int().min(0),
  pronos_exacts: z.number().int().min(0),
  prenom: z.string().nullable(),
  nom: z.string().nullable(),
  avatar_url: z.string().nullable(),
});

export type ClassementRow = z.infer<typeof classementRowSchema>;

/**
 * Normalise une ligne brute issue de la vue (tous les champs nullable)
 * vers le schéma strict.
 *
 * Retourne `null` si la ligne est inutilisable (pas de user_id /
 * concours_id) pour qu'on puisse la filtrer côté api.
 */
export const normalizeClassementRow = (raw: {
  concours_id: string | null;
  user_id: string | null;
  rang: number | null;
  points: number | null;
  pronos_joues: number | null;
  pronos_gagnes: number | null;
  pronos_exacts: number | null;
  prenom: string | null;
  nom: string | null;
  avatar_url: string | null;
}): ClassementRow | null => {
  if (!raw.concours_id || !raw.user_id) return null;

  const candidate = {
    concours_id: raw.concours_id,
    user_id: raw.user_id,
    rang: raw.rang ?? 1,
    points: raw.points ?? 0,
    pronos_joues: raw.pronos_joues ?? 0,
    pronos_gagnes: raw.pronos_gagnes ?? 0,
    pronos_exacts: raw.pronos_exacts ?? 0,
    prenom: raw.prenom,
    nom: raw.nom,
    avatar_url: raw.avatar_url,
  };

  const parsed = classementRowSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
};

// ------------------------------------------------------------------
//  PRONOS POINTS ROW (1 ligne par prono d'un user dans un concours)
// ------------------------------------------------------------------

/**
 * Phases possibles côté vue (même CHECK que `matchs.phase`).
 * On duplique la liste ici plutôt que de l'importer depuis pronos pour
 * garder les features indépendantes.
 */
export const CLASSEMENT_PHASE_VALUES = [
  'groupes',
  'seiziemes',
  'huitiemes',
  'quarts',
  'demis',
  'petite_finale',
  'finale',
] as const;
export type ClassementPhase = (typeof CLASSEMENT_PHASE_VALUES)[number];

export const MATCH_STATUS_VALUES = [
  'scheduled',
  'live',
  'finished',
  'cancelled',
] as const;
export type MatchStatus = (typeof MATCH_STATUS_VALUES)[number];

export const pronoPointsRowSchema = z.object({
  concours_id: z.string().uuid(),
  user_id: z.string().uuid(),
  match_id: z.string().uuid(),
  phase: z.enum(CLASSEMENT_PHASE_VALUES),
  match_status: z.enum(MATCH_STATUS_VALUES),
  is_final: z.boolean(),
  is_exact: z.boolean(),
  points_base: z.number().int().min(0),
  bonus_ko: z.number().int().min(0),
  cote_appliquee: z.number().min(1).nullable(),
});

export type PronoPointsRow = z.infer<typeof pronoPointsRowSchema>;

/**
 * Calcule le total de points d'une ligne `v_pronos_points` en suivant
 * la même formule que la vue `v_classement_concours` :
 *   points_final = round((points_base + bonus_ko) * coalesce(cote, 1))
 *
 * Utile côté UI pour afficher un breakdown match par match sans refaire
 * un appel agrégé.
 */
export const computePronoTotal = (row: PronoPointsRow): number => {
  if (!row.is_final) return 0;
  const base = row.points_base + row.bonus_ko;
  const mult = row.cote_appliquee ?? 1;
  return Math.round(base * mult);
};

/**
 * Normalise une ligne brute issue de `v_pronos_points`.
 */
export const normalizePronoPointsRow = (raw: {
  concours_id: string | null;
  user_id: string | null;
  match_id: string | null;
  phase: string | null;
  match_status: string | null;
  is_final: boolean | null;
  is_exact: boolean | null;
  points_base: number | null;
  bonus_ko: number | null;
  cote_appliquee: number | null;
}): PronoPointsRow | null => {
  if (!raw.concours_id || !raw.user_id || !raw.match_id) return null;

  const candidate = {
    concours_id: raw.concours_id,
    user_id: raw.user_id,
    match_id: raw.match_id,
    phase: raw.phase,
    match_status: raw.match_status,
    is_final: raw.is_final ?? false,
    is_exact: raw.is_exact ?? false,
    points_base: raw.points_base ?? 0,
    bonus_ko: raw.bonus_ko ?? 0,
    cote_appliquee: raw.cote_appliquee,
  };

  const parsed = pronoPointsRowSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
};
