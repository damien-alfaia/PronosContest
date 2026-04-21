import { describe, expect, it } from 'vitest';

import {
  BADGE_CATEGORY_VALUES,
  BADGE_TIER_RANK,
  BADGE_TIER_VALUES,
  badgeCatalogRowSchema,
  badgeLocalizedSchema,
  compareBadgeCatalog,
  compareUserBadgeByRecent,
  normalizeBadgeCatalogRow,
  normalizeUserBadgeRow,
  normalizeUserBadgeWithCatalog,
  pickLocalized,
  userBadgeRowSchema,
  type BadgeCatalogRow,
  type UserBadgeWithCatalog,
} from '@/features/badges/schemas';

const USER = '11111111-1111-1111-1111-111111111111';

const validLocalized = { fr: 'Parfait', en: 'Perfect' };
const validCatalogRaw = {
  code: 'pronostic_parfait',
  category: 'skill',
  tier: 'silver',
  libelle: validLocalized,
  description: { fr: 'Score exact', en: 'Exact score' },
  icon: 'Target',
  sort_order: 30,
};

// ==================================================================
//  Constantes
// ==================================================================

describe('constantes', () => {
  it('BADGE_CATEGORY_VALUES contient les 10 catégories alignées sur le CHECK SQL', () => {
    expect(BADGE_CATEGORY_VALUES).toEqual([
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
    ]);
  });

  it('BADGE_TIER_VALUES contient les 4 tiers ordonnés bronze → legendary', () => {
    expect(BADGE_TIER_VALUES).toEqual(['bronze', 'silver', 'gold', 'legendary']);
  });

  it('BADGE_TIER_RANK classe legendary en premier, bronze en dernier', () => {
    expect(BADGE_TIER_RANK.legendary).toBeLessThan(BADGE_TIER_RANK.gold);
    expect(BADGE_TIER_RANK.gold).toBeLessThan(BADGE_TIER_RANK.silver);
    expect(BADGE_TIER_RANK.silver).toBeLessThan(BADGE_TIER_RANK.bronze);
  });
});

// ==================================================================
//  badgeLocalizedSchema + pickLocalized
// ==================================================================

describe('badgeLocalizedSchema', () => {
  it('accepte {fr, en}', () => {
    expect(badgeLocalizedSchema.safeParse(validLocalized).success).toBe(true);
  });

  it('rejette si fr manque', () => {
    expect(badgeLocalizedSchema.safeParse({ en: 'ok' }).success).toBe(false);
  });

  it('rejette si les chaînes sont vides', () => {
    expect(
      badgeLocalizedSchema.safeParse({ fr: '', en: 'ok' }).success,
    ).toBe(false);
  });
});

describe('pickLocalized', () => {
  it('retourne le fr en français', () => {
    expect(pickLocalized(validLocalized, 'fr')).toBe('Parfait');
  });
  it('retourne le en en anglais', () => {
    expect(pickLocalized(validLocalized, 'en')).toBe('Perfect');
  });
});

// ==================================================================
//  badgeCatalogRowSchema + normalizeBadgeCatalogRow
// ==================================================================

describe('badgeCatalogRowSchema', () => {
  it('parse une ligne valide', () => {
    const res = badgeCatalogRowSchema.safeParse(validCatalogRaw);
    expect(res.success).toBe(true);
  });

  it('rejette une catégorie inconnue', () => {
    const res = badgeCatalogRowSchema.safeParse({
      ...validCatalogRaw,
      category: 'unknown',
    });
    expect(res.success).toBe(false);
  });

  it('rejette un tier inconnu', () => {
    const res = badgeCatalogRowSchema.safeParse({
      ...validCatalogRaw,
      tier: 'platinum',
    });
    expect(res.success).toBe(false);
  });

  it('rejette libelle sans en', () => {
    const res = badgeCatalogRowSchema.safeParse({
      ...validCatalogRaw,
      libelle: { fr: 'x' },
    });
    expect(res.success).toBe(false);
  });
});

describe('normalizeBadgeCatalogRow', () => {
  it('retourne null si code manquant', () => {
    const res = normalizeBadgeCatalogRow({
      ...validCatalogRaw,
      code: null,
    });
    expect(res).toBeNull();
  });

  it('retourne null si libelle mal formé', () => {
    const res = normalizeBadgeCatalogRow({
      ...validCatalogRaw,
      libelle: { fr: 'only fr' } as unknown,
    });
    expect(res).toBeNull();
  });

  it('sort_order null → coalesce à 0', () => {
    const res = normalizeBadgeCatalogRow({
      ...validCatalogRaw,
      sort_order: null,
    });
    expect(res?.sort_order).toBe(0);
  });

  it('retourne un objet strictement typé', () => {
    const res = normalizeBadgeCatalogRow(validCatalogRaw);
    expect(res).not.toBeNull();
    expect(res?.code).toBe('pronostic_parfait');
    expect(res?.tier).toBe('silver');
  });
});

// ==================================================================
//  userBadgeRowSchema + normalizeUserBadgeRow
// ==================================================================

describe('userBadgeRowSchema', () => {
  it('parse une ligne user_badge valide', () => {
    const res = userBadgeRowSchema.safeParse({
      user_id: USER,
      badge_code: 'rookie',
      earned_at: '2026-04-20T12:00:00Z',
      metadata: {},
    });
    expect(res.success).toBe(true);
  });

  it('rejette si user_id n est pas un UUID', () => {
    const res = userBadgeRowSchema.safeParse({
      user_id: 'not-uuid',
      badge_code: 'rookie',
      earned_at: '2026-04-20T12:00:00Z',
      metadata: {},
    });
    expect(res.success).toBe(false);
  });
});

describe('normalizeUserBadgeRow', () => {
  it('retourne null si user_id manquant', () => {
    expect(
      normalizeUserBadgeRow({
        user_id: null,
        badge_code: 'rookie',
        earned_at: 'x',
        metadata: {},
      }),
    ).toBeNull();
  });

  it('retourne null si earned_at manquant', () => {
    expect(
      normalizeUserBadgeRow({
        user_id: USER,
        badge_code: 'rookie',
        earned_at: null,
        metadata: {},
      }),
    ).toBeNull();
  });

  it('metadata non-objet → coalesce à {}', () => {
    const res = normalizeUserBadgeRow({
      user_id: USER,
      badge_code: 'rookie',
      earned_at: '2026-04-20T12:00:00Z',
      metadata: 42 as unknown,
    });
    expect(res?.metadata).toEqual({});
  });
});

// ==================================================================
//  normalizeUserBadgeWithCatalog
// ==================================================================

describe('normalizeUserBadgeWithCatalog', () => {
  it('joint correctement user_badge + catalog', () => {
    const res = normalizeUserBadgeWithCatalog({
      user_id: USER,
      badge_code: 'pronostic_parfait',
      earned_at: '2026-04-20T12:00:00Z',
      metadata: { match_id: 'abc' },
      badge: validCatalogRaw,
    });
    expect(res).not.toBeNull();
    expect(res?.badge.code).toBe('pronostic_parfait');
    expect(res?.metadata).toEqual({ match_id: 'abc' });
  });

  it('retourne null si badge joint est null', () => {
    const res = normalizeUserBadgeWithCatalog({
      user_id: USER,
      badge_code: 'rookie',
      earned_at: '2026-04-20T12:00:00Z',
      metadata: {},
      badge: null,
    });
    expect(res).toBeNull();
  });

  it('retourne null si user_badge est invalide', () => {
    const res = normalizeUserBadgeWithCatalog({
      user_id: null,
      badge_code: 'rookie',
      earned_at: '2026-04-20T12:00:00Z',
      metadata: {},
      badge: validCatalogRaw,
    });
    expect(res).toBeNull();
  });

  it('retourne null si catalog joint est invalide (libelle cassé)', () => {
    const res = normalizeUserBadgeWithCatalog({
      user_id: USER,
      badge_code: 'rookie',
      earned_at: '2026-04-20T12:00:00Z',
      metadata: {},
      badge: { ...validCatalogRaw, libelle: { fr: 'only' } as unknown },
    });
    expect(res).toBeNull();
  });
});

// ==================================================================
//  compareBadgeCatalog
// ==================================================================

const makeBadge = (
  over: Partial<BadgeCatalogRow>,
): BadgeCatalogRow => ({
  code: 'x',
  category: 'skill',
  tier: 'silver',
  libelle: validLocalized,
  description: validLocalized,
  icon: 'Target',
  sort_order: 0,
  ...over,
});

describe('compareBadgeCatalog', () => {
  it('trie par tier : legendary avant gold avant silver avant bronze', () => {
    const arr = [
      makeBadge({ code: 'b', tier: 'bronze' }),
      makeBadge({ code: 'l', tier: 'legendary' }),
      makeBadge({ code: 's', tier: 'silver' }),
      makeBadge({ code: 'g', tier: 'gold' }),
    ];
    arr.sort(compareBadgeCatalog);
    expect(arr.map((b) => b.code)).toEqual(['l', 'g', 's', 'b']);
  });

  it('trie par sort_order à tier égal', () => {
    const arr = [
      makeBadge({ code: 'second', tier: 'gold', sort_order: 20 }),
      makeBadge({ code: 'first', tier: 'gold', sort_order: 10 }),
    ];
    arr.sort(compareBadgeCatalog);
    expect(arr.map((b) => b.code)).toEqual(['first', 'second']);
  });

  it('fallback sur code à tier + sort_order égaux', () => {
    const arr = [
      makeBadge({ code: 'b', tier: 'gold', sort_order: 10 }),
      makeBadge({ code: 'a', tier: 'gold', sort_order: 10 }),
    ];
    arr.sort(compareBadgeCatalog);
    expect(arr.map((b) => b.code)).toEqual(['a', 'b']);
  });
});

// ==================================================================
//  compareUserBadgeByRecent
// ==================================================================

describe('compareUserBadgeByRecent', () => {
  const makeUB = (earnedAt: string): UserBadgeWithCatalog => ({
    user_id: USER,
    badge_code: 'x',
    earned_at: earnedAt,
    metadata: {},
    badge: makeBadge({ code: 'x' }),
  });

  it('trie le plus récent en premier', () => {
    const arr = [
      makeUB('2026-01-01T00:00:00Z'),
      makeUB('2026-05-01T00:00:00Z'),
      makeUB('2026-03-01T00:00:00Z'),
    ];
    arr.sort(compareUserBadgeByRecent);
    expect(arr.map((u) => u.earned_at)).toEqual([
      '2026-05-01T00:00:00Z',
      '2026-03-01T00:00:00Z',
      '2026-01-01T00:00:00Z',
    ]);
  });
});
