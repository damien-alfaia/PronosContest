import { z } from 'zod';

/**
 * Schémas Zod pour la feature badges.
 *
 * Deux tables SQL (migration `20260423120000_init_badges.sql`) :
 *   - `badges` (catalogue immuable, seedé, 28 entrées)
 *   - `user_badges` (attribution idempotente, PK composite user+code)
 *
 * Les colonnes `libelle` / `description` sont des jsonb `{fr, en}`
 * (CHECK côté SQL : les deux clés sont obligatoires). On normalise
 * ici en un objet strict pour typer le front sans `as` / `??`.
 *
 * Les icônes sont des noms de composants `lucide-react` (ex: `Trophy`,
 * `Flame`, `Crown`) — on garde la string brute, le front résoudra.
 */

// ------------------------------------------------------------------
//  CATÉGORIES & TIERS (alignés sur les CHECK SQL)
// ------------------------------------------------------------------

export const BADGE_CATEGORY_VALUES = [
  'lifecycle',
  'volume',
  'skill',
  'regularity',
  'completude',
  'classement',
  'social',
  'fun',
  'temporal',
  'legendary',
] as const;
export type BadgeCategory = (typeof BADGE_CATEGORY_VALUES)[number];

export const BADGE_TIER_VALUES = [
  'bronze',
  'silver',
  'gold',
  'legendary',
] as const;
export type BadgeTier = (typeof BADGE_TIER_VALUES)[number];

/**
 * Ordre d'affichage canonique des tiers (du plus prestigieux au moins).
 * Utile pour trier / grouper côté UI sans hardcoder dans chaque composant.
 */
export const BADGE_TIER_RANK: Record<BadgeTier, number> = {
  legendary: 0,
  gold: 1,
  silver: 2,
  bronze: 3,
};

// ------------------------------------------------------------------
//  TEXTE LOCALISÉ `{fr, en}`
// ------------------------------------------------------------------

export const badgeLocalizedSchema = z.object({
  fr: z.string().min(1),
  en: z.string().min(1),
});
export type BadgeLocalized = z.infer<typeof badgeLocalizedSchema>;

/**
 * Résout un texte localisé selon la langue courante.
 * Fallback sur `fr` si la locale demandée manque (ne devrait jamais
 * arriver grâce au CHECK SQL, mais on reste défensif).
 */
export const pickLocalized = (
  localized: BadgeLocalized,
  lang: 'fr' | 'en',
): string => localized[lang] ?? localized.fr;

// ------------------------------------------------------------------
//  CATALOGUE BADGE (table `badges`)
// ------------------------------------------------------------------

export const badgeCatalogRowSchema = z.object({
  code: z.string().min(1),
  category: z.enum(BADGE_CATEGORY_VALUES),
  tier: z.enum(BADGE_TIER_VALUES),
  libelle: badgeLocalizedSchema,
  description: badgeLocalizedSchema,
  icon: z.string().min(1),
  sort_order: z.number().int(),
});
export type BadgeCatalogRow = z.infer<typeof badgeCatalogRowSchema>;

/**
 * Normalise une ligne brute de `badges` :
 *   - `libelle` / `description` remontent en `Json` (unknown-ish) des
 *     types Supabase : on valide la forme `{fr, en}` via Zod.
 *   - Les lignes non conformes sont filtrées (retour `null`) pour que
 *     l'UI ne plante pas sur un seed cassé.
 */
export const normalizeBadgeCatalogRow = (raw: {
  code: string | null;
  category: string | null;
  tier: string | null;
  libelle: unknown;
  description: unknown;
  icon: string | null;
  sort_order: number | null;
}): BadgeCatalogRow | null => {
  if (!raw.code) return null;

  const candidate = {
    code: raw.code,
    category: raw.category,
    tier: raw.tier,
    libelle: raw.libelle,
    description: raw.description,
    icon: raw.icon,
    sort_order: raw.sort_order ?? 0,
  };

  const parsed = badgeCatalogRowSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
};

// ------------------------------------------------------------------
//  USER BADGE (table `user_badges`)
// ------------------------------------------------------------------

export const userBadgeRowSchema = z.object({
  user_id: z.string().uuid(),
  badge_code: z.string().min(1),
  earned_at: z.string(), // ISO-8601 (timestamptz sérialisé)
  metadata: z.record(z.string(), z.unknown()),
});
export type UserBadgeRow = z.infer<typeof userBadgeRowSchema>;

export const normalizeUserBadgeRow = (raw: {
  user_id: string | null;
  badge_code: string | null;
  earned_at: string | null;
  metadata: unknown;
}): UserBadgeRow | null => {
  if (!raw.user_id || !raw.badge_code || !raw.earned_at) return null;

  const candidate = {
    user_id: raw.user_id,
    badge_code: raw.badge_code,
    earned_at: raw.earned_at,
    metadata:
      typeof raw.metadata === 'object' && raw.metadata !== null
        ? (raw.metadata as Record<string, unknown>)
        : {},
  };

  const parsed = userBadgeRowSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
};

// ------------------------------------------------------------------
//  USER BADGE + CATALOGUE JOINT (vue de consommation front)
// ------------------------------------------------------------------

/**
 * Ligne jointe user_badges × badges pour la UI. C'est ce que les
 * composants consomment (liste sur le profil, toasts, etc.).
 */
export const userBadgeWithCatalogSchema = userBadgeRowSchema.extend({
  badge: badgeCatalogRowSchema,
});
export type UserBadgeWithCatalog = z.infer<typeof userBadgeWithCatalogSchema>;

/**
 * Normalise la forme renvoyée par le join Supabase `user_badges`
 * + `badge:badges(*)`. Supabase retourne le nested comme un objet
 * (jamais un tableau ici, la FK étant 1-1).
 *
 * Retourne `null` si l'une des deux moitiés est invalide — on filtre
 * côté api pour ne pas retourner de lignes dégradées.
 */
export const normalizeUserBadgeWithCatalog = (raw: {
  user_id: string | null;
  badge_code: string | null;
  earned_at: string | null;
  metadata: unknown;
  badge: {
    code: string | null;
    category: string | null;
    tier: string | null;
    libelle: unknown;
    description: unknown;
    icon: string | null;
    sort_order: number | null;
  } | null;
}): UserBadgeWithCatalog | null => {
  if (!raw.badge) return null;

  const ub = normalizeUserBadgeRow({
    user_id: raw.user_id,
    badge_code: raw.badge_code,
    earned_at: raw.earned_at,
    metadata: raw.metadata,
  });
  const cat = normalizeBadgeCatalogRow(raw.badge);

  if (!ub || !cat) return null;

  return { ...ub, badge: cat };
};

// ------------------------------------------------------------------
//  HELPERS DE TRI
// ------------------------------------------------------------------

/**
 * Compare deux badges (catalog) pour un tri stable :
 *   1) tier (legendary > gold > silver > bronze),
 *   2) sort_order ascendant (ordre de seed contrôlé côté SQL),
 *   3) code ascendant (fallback déterministe).
 */
export const compareBadgeCatalog = (
  a: BadgeCatalogRow,
  b: BadgeCatalogRow,
): number => {
  const tierDiff = BADGE_TIER_RANK[a.tier] - BADGE_TIER_RANK[b.tier];
  if (tierDiff !== 0) return tierDiff;
  const orderDiff = a.sort_order - b.sort_order;
  if (orderDiff !== 0) return orderDiff;
  return a.code.localeCompare(b.code);
};

/**
 * Compare deux user_badges+catalog, priorité au plus récent (earned_at
 * desc). Utile pour la section "Derniers badges" sur le profil.
 */
export const compareUserBadgeByRecent = (
  a: UserBadgeWithCatalog,
  b: UserBadgeWithCatalog,
): number => b.earned_at.localeCompare(a.earned_at);
