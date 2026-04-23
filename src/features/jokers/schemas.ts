import { z } from 'zod';

/**
 * Schémas Zod pour la feature jokers (Sprint 8.A).
 *
 * Deux tables SQL (migration `20260426120000_init_jokers.sql`) :
 *   - `jokers` (catalogue immuable, seedé, 7 entrées)
 *   - `user_jokers` (possessions, 1 ligne = 1 slot, `used_at is null` = owned)
 *
 * Les colonnes `libelle` / `description` sont des jsonb `{fr, en}` (CHECK
 * côté SQL : les deux clés sont obligatoires). On normalise ici en un objet
 * strict pour typer le front sans `as` / `??`.
 *
 * Les icônes sont des noms de composants `lucide-react` (ex: `Flame`,
 * `Compass`, `Swords`) — on garde la string brute, le front résoudra
 * dynamiquement (cf. `joker-icon.tsx` en 8.A.4).
 *
 * Les fichiers api/use-jokers mockent `@/lib/supabase` dans les tests,
 * donc on n'importe PAS les types générés (`Database`) ici — la feature
 * reste résiliente tant que `supabase gen types` n'a pas réécrit
 * `src/types/database.ts`.
 */

// ------------------------------------------------------------------
//  CATÉGORIES & ORIGINES (alignés sur les CHECK SQL)
// ------------------------------------------------------------------

export const JOKER_CATEGORY_VALUES = [
  'boost',
  'info',
  'challenge',
  'social',
] as const;
export type JokerCategory = (typeof JOKER_CATEGORY_VALUES)[number];

export const JOKER_ACQUIRED_FROM_VALUES = ['starter', 'badge', 'gift'] as const;
export type JokerAcquiredFrom = (typeof JOKER_ACQUIRED_FROM_VALUES)[number];

/**
 * Ordre d'affichage canonique des catégories (prioritaire → secondaire).
 * Utile pour trier les jokers dans la section "Mes jokers" sans hardcoder.
 */
export const JOKER_CATEGORY_RANK: Record<JokerCategory, number> = {
  boost: 0,
  challenge: 1,
  info: 2,
  social: 3,
};

// ------------------------------------------------------------------
//  TEXTE LOCALISÉ `{fr, en}`
// ------------------------------------------------------------------

export const jokerLocalizedSchema = z.object({
  fr: z.string().min(1),
  en: z.string().min(1),
});
export type JokerLocalized = z.infer<typeof jokerLocalizedSchema>;

/**
 * Résout un texte localisé selon la langue courante.
 * Fallback sur `fr` si la locale demandée manque (ne devrait jamais
 * arriver grâce au CHECK SQL, mais on reste défensif).
 */
export const pickLocalized = (
  localized: JokerLocalized,
  lang: 'fr' | 'en',
): string => localized[lang] ?? localized.fr;

// ------------------------------------------------------------------
//  CATALOGUE JOKER (table `jokers`)
// ------------------------------------------------------------------

export const jokerCatalogRowSchema = z.object({
  code: z.string().min(1),
  category: z.enum(JOKER_CATEGORY_VALUES),
  libelle: jokerLocalizedSchema,
  description: jokerLocalizedSchema,
  icon: z.string().min(1),
  sort_order: z.number().int(),
});
export type JokerCatalogRow = z.infer<typeof jokerCatalogRowSchema>;

/**
 * Normalise une ligne brute de `jokers` :
 *   - `libelle` / `description` remontent en `Json` (unknown-ish) des
 *     types Supabase : on valide la forme `{fr, en}` via Zod.
 *   - Les lignes non conformes sont filtrées (retour `null`) pour que
 *     l'UI ne plante pas sur un seed cassé.
 */
export const normalizeJokerCatalogRow = (raw: {
  code: string | null;
  category: string | null;
  libelle: unknown;
  description: unknown;
  icon: string | null;
  sort_order: number | null;
}): JokerCatalogRow | null => {
  if (!raw.code) return null;

  const candidate = {
    code: raw.code,
    category: raw.category,
    libelle: raw.libelle,
    description: raw.description,
    icon: raw.icon,
    sort_order: raw.sort_order ?? 0,
  };

  const parsed = jokerCatalogRowSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
};

// ------------------------------------------------------------------
//  USER JOKER (table `user_jokers`)
// ------------------------------------------------------------------

/**
 * `used_*` restent null tant qu'on n'a pas activé l'usage (Sprint 8.B).
 * Le CHECK SQL `user_jokers_used_coherence` garantit que si `used_at is
 * null`, toutes les autres colonnes `used_*` sont null aussi — on reprend
 * la même logique côté Zod via `superRefine` pour capturer les données
 * incohérentes avant qu'elles atteignent la UI.
 */
export const userJokerRowSchema = z
  .object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    concours_id: z.string().uuid(),
    joker_code: z.string().min(1),
    acquired_from: z.enum(JOKER_ACQUIRED_FROM_VALUES),
    acquired_at: z.string(), // ISO-8601 (timestamptz sérialisé)

    used_at: z.string().nullable(),
    used_on_match_id: z.string().uuid().nullable(),
    used_on_target_user_id: z.string().uuid().nullable(),
    used_payload: z.record(z.string(), z.unknown()).nullable(),
  })
  .superRefine((val, ctx) => {
    // Si pas utilisé, aucun `used_*` ne doit être rempli.
    if (val.used_at === null) {
      if (
        val.used_on_match_id !== null ||
        val.used_on_target_user_id !== null ||
        val.used_payload !== null
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'used_at is null but other used_* fields are populated',
        });
      }
    }
  });
export type UserJokerRow = z.infer<typeof userJokerRowSchema>;

export const normalizeUserJokerRow = (raw: {
  id: string | null;
  user_id: string | null;
  concours_id: string | null;
  joker_code: string | null;
  acquired_from: string | null;
  acquired_at: string | null;
  used_at: string | null;
  used_on_match_id: string | null;
  used_on_target_user_id: string | null;
  used_payload: unknown;
}): UserJokerRow | null => {
  if (!raw.id || !raw.user_id || !raw.concours_id || !raw.joker_code) {
    return null;
  }
  if (!raw.acquired_from || !raw.acquired_at) return null;

  // used_payload vient de Supabase comme Json | null → on coerce vers
  // Record<string, unknown> si c'est un objet, sinon null (on refuse les
  // tableaux et primitives pour rester cohérent avec l'usage côté SQL).
  const normalizedPayload: Record<string, unknown> | null =
    typeof raw.used_payload === 'object' &&
    raw.used_payload !== null &&
    !Array.isArray(raw.used_payload)
      ? (raw.used_payload as Record<string, unknown>)
      : null;

  const candidate = {
    id: raw.id,
    user_id: raw.user_id,
    concours_id: raw.concours_id,
    joker_code: raw.joker_code,
    acquired_from: raw.acquired_from,
    acquired_at: raw.acquired_at,
    used_at: raw.used_at,
    used_on_match_id: raw.used_on_match_id,
    used_on_target_user_id: raw.used_on_target_user_id,
    used_payload: normalizedPayload,
  };

  const parsed = userJokerRowSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
};

/**
 * Statut dérivé d'un slot `user_jokers` :
 *   - `owned` : possédé mais pas encore consommé
 *   - `used`  : consommé (used_at renseigné)
 */
export const isJokerOwned = (row: UserJokerRow): boolean =>
  row.used_at === null;

// ------------------------------------------------------------------
//  USER JOKER + CATALOGUE JOINT (vue de consommation front)
// ------------------------------------------------------------------

/**
 * Ligne jointe user_jokers × jokers pour la UI. C'est ce que les
 * composants consomment (section "Mes jokers", prompts d'activation).
 */
export const userJokerWithCatalogSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  concours_id: z.string().uuid(),
  joker_code: z.string().min(1),
  acquired_from: z.enum(JOKER_ACQUIRED_FROM_VALUES),
  acquired_at: z.string(),
  used_at: z.string().nullable(),
  used_on_match_id: z.string().uuid().nullable(),
  used_on_target_user_id: z.string().uuid().nullable(),
  used_payload: z.record(z.string(), z.unknown()).nullable(),
  joker: jokerCatalogRowSchema,
});
export type UserJokerWithCatalog = z.infer<typeof userJokerWithCatalogSchema>;

/**
 * Normalise la forme renvoyée par le join Supabase `user_jokers`
 * + `joker:jokers(*)`. Supabase retourne le nested comme un objet
 * (jamais un tableau ici, la FK étant 1-1).
 *
 * Retourne `null` si l'une des deux moitiés est invalide — on filtre
 * côté api pour ne pas retourner de lignes dégradées.
 */
export const normalizeUserJokerWithCatalog = (raw: {
  id: string | null;
  user_id: string | null;
  concours_id: string | null;
  joker_code: string | null;
  acquired_from: string | null;
  acquired_at: string | null;
  used_at: string | null;
  used_on_match_id: string | null;
  used_on_target_user_id: string | null;
  used_payload: unknown;
  joker:
    | {
        code: string | null;
        category: string | null;
        libelle: unknown;
        description: unknown;
        icon: string | null;
        sort_order: number | null;
      }
    | Array<{
        code: string | null;
        category: string | null;
        libelle: unknown;
        description: unknown;
        icon: string | null;
        sort_order: number | null;
      }>
    | null;
}): UserJokerWithCatalog | null => {
  if (!raw.joker) return null;

  // Supabase renvoie l'embed `joker:jokers(*)` comme objet en 1-1 mais
  // certains types générés le typent en tableau → on unwrap défensivement.
  const jokerRaw = Array.isArray(raw.joker) ? raw.joker[0] : raw.joker;
  if (!jokerRaw) return null;

  const uj = normalizeUserJokerRow({
    id: raw.id,
    user_id: raw.user_id,
    concours_id: raw.concours_id,
    joker_code: raw.joker_code,
    acquired_from: raw.acquired_from,
    acquired_at: raw.acquired_at,
    used_at: raw.used_at,
    used_on_match_id: raw.used_on_match_id,
    used_on_target_user_id: raw.used_on_target_user_id,
    used_payload: raw.used_payload,
  });
  const cat = normalizeJokerCatalogRow(jokerRaw);

  if (!uj || !cat) return null;

  return { ...uj, joker: cat };
};

// ------------------------------------------------------------------
//  HELPERS DE TRI
// ------------------------------------------------------------------

/**
 * Compare deux jokers (catalog) pour un tri stable :
 *   1) category (boost → challenge → info → social),
 *   2) sort_order ascendant (ordre de seed contrôlé côté SQL),
 *   3) code ascendant (fallback déterministe).
 */
export const compareJokerCatalog = (
  a: JokerCatalogRow,
  b: JokerCatalogRow,
): number => {
  const catDiff =
    JOKER_CATEGORY_RANK[a.category] - JOKER_CATEGORY_RANK[b.category];
  if (catDiff !== 0) return catDiff;
  const orderDiff = a.sort_order - b.sort_order;
  if (orderDiff !== 0) return orderDiff;
  return a.code.localeCompare(b.code);
};

/**
 * Compare deux user_jokers+catalog pour la section "Mes jokers" :
 *   1) owned en premier, used ensuite (owned = used_at is null)
 *   2) au sein d'un statut, ordre catalogue (via compareJokerCatalog)
 *   3) tie-break par acquired_at desc (le plus récent d'abord dans le bucket)
 */
export const compareUserJokerForInventory = (
  a: UserJokerWithCatalog,
  b: UserJokerWithCatalog,
): number => {
  const aOwned = a.used_at === null ? 0 : 1;
  const bOwned = b.used_at === null ? 0 : 1;
  if (aOwned !== bOwned) return aOwned - bOwned;

  const catCmp = compareJokerCatalog(a.joker, b.joker);
  if (catCmp !== 0) return catCmp;

  // acquired_at desc = le plus récent d'abord
  return b.acquired_at.localeCompare(a.acquired_at);
};

/**
 * Compare deux user_jokers+catalog pour la section "Historique jokers"
 * (page profil, Sprint 8.C.3) :
 *   1) date d'activité la plus récente desc
 *      = max(used_at, acquired_at). `used_at` est toujours >= `acquired_at`
 *      par construction SQL (on ne peut pas utiliser avant d'avoir acquis),
 *      donc pratiquement `used_at ?? acquired_at`.
 *   2) tie-break par acquired_at desc.
 *
 * Ce tri diffère de `compareUserJokerForInventory` : sur la page profil,
 * on veut une timeline chronologique (événements récents en haut), pas un
 * inventaire groupé par statut.
 */
export const compareUserJokerByLastActivity = (
  a: UserJokerWithCatalog,
  b: UserJokerWithCatalog,
): number => {
  const aDate = a.used_at ?? a.acquired_at;
  const bDate = b.used_at ?? b.acquired_at;
  const activityDiff = bDate.localeCompare(aDate);
  if (activityDiff !== 0) return activityDiff;
  return b.acquired_at.localeCompare(a.acquired_at);
};

// ------------------------------------------------------------------
//  BOUSSOLE (RPC boussole_most_common_score)
// ------------------------------------------------------------------

/**
 * Résultat de la RPC `boussole_most_common_score(concours_id, match_id)`
 * (Sprint 8.B.1) : agrégat anonymisé du score exact le plus fréquent
 * parmi les pronos du concours sur un match donné.
 *
 * - `score_a` / `score_b` : le score exact majoritaire (0..99 comme les
 *   bornes CHECK SQL de `pronos.score_a/b`).
 * - `count` : nombre de pronos ayant ce score exact (≥ 1).
 *
 * `null` si aucun prono n'existe encore sur le match (tableau vide côté
 * SQL → la RPC retourne `null`, la boussole ne révèle alors rien).
 *
 * ⚠️ La RPC est `SECURITY DEFINER` et ne renvoie QUE l'agrégat : elle ne
 * permet jamais de remonter à une ligne individuelle (pas de user_id),
 * ce qui garantit que la boussole ne contourne pas la RLS `pronos` avant
 * kick-off.
 */
export const boussoleResultSchema = z
  .object({
    score_a: z.number().int().min(0).max(99),
    score_b: z.number().int().min(0).max(99),
    count: z.number().int().min(1),
  })
  .nullable();
export type BoussoleResult = z.infer<typeof boussoleResultSchema>;
