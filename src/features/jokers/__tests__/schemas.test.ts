import { describe, expect, it } from 'vitest';

import {
  JOKER_ACQUIRED_FROM_VALUES,
  JOKER_CATEGORY_RANK,
  JOKER_CATEGORY_VALUES,
  compareJokerCatalog,
  compareUserJokerForInventory,
  isJokerOwned,
  jokerCatalogRowSchema,
  jokerLocalizedSchema,
  normalizeJokerCatalogRow,
  normalizeUserJokerRow,
  normalizeUserJokerWithCatalog,
  pickLocalized,
  userJokerRowSchema,
  userJokerWithCatalogSchema,
  type JokerCatalogRow,
  type UserJokerWithCatalog,
} from '@/features/jokers/schemas';

const USER = '11111111-1111-1111-1111-111111111111';
const CONCOURS = '22222222-2222-2222-2222-222222222222';
const SLOT = '33333333-3333-3333-3333-333333333333';

const validLocalized = { fr: 'Double', en: 'Double' };

const validCatalogRaw = {
  code: 'double',
  category: 'boost',
  libelle: validLocalized,
  description: { fr: 'Points ×2', en: '×2 points' },
  icon: 'Flame',
  sort_order: 10,
};

const validUserJokerRaw = {
  id: SLOT,
  user_id: USER,
  concours_id: CONCOURS,
  joker_code: 'double',
  acquired_from: 'starter',
  acquired_at: '2026-04-22T10:00:00Z',
  used_at: null,
  used_on_match_id: null,
  used_on_target_user_id: null,
  used_payload: null,
};

// ==================================================================
//  Constantes
// ==================================================================

describe('constantes', () => {
  it('JOKER_CATEGORY_VALUES contient les 4 catégories alignées sur le CHECK SQL', () => {
    expect(JOKER_CATEGORY_VALUES).toEqual([
      'boost',
      'info',
      'challenge',
      'social',
    ]);
  });

  it('JOKER_ACQUIRED_FROM_VALUES contient les 3 origines alignées sur le CHECK SQL', () => {
    expect(JOKER_ACQUIRED_FROM_VALUES).toEqual(['starter', 'badge', 'gift']);
  });

  it('JOKER_CATEGORY_RANK trie boost < challenge < info < social', () => {
    expect(JOKER_CATEGORY_RANK.boost).toBeLessThan(
      JOKER_CATEGORY_RANK.challenge,
    );
    expect(JOKER_CATEGORY_RANK.challenge).toBeLessThan(
      JOKER_CATEGORY_RANK.info,
    );
    expect(JOKER_CATEGORY_RANK.info).toBeLessThan(JOKER_CATEGORY_RANK.social);
  });
});

// ==================================================================
//  jokerLocalizedSchema + pickLocalized
// ==================================================================

describe('jokerLocalizedSchema', () => {
  it('accepte {fr, en}', () => {
    expect(jokerLocalizedSchema.safeParse(validLocalized).success).toBe(true);
  });

  it('rejette si fr manque', () => {
    expect(jokerLocalizedSchema.safeParse({ en: 'ok' }).success).toBe(false);
  });

  it('rejette si les chaînes sont vides', () => {
    expect(jokerLocalizedSchema.safeParse({ fr: '', en: 'ok' }).success).toBe(
      false,
    );
  });
});

describe('pickLocalized', () => {
  it('retourne le fr en français', () => {
    expect(pickLocalized(validLocalized, 'fr')).toBe('Double');
  });
  it('retourne le en en anglais', () => {
    expect(pickLocalized(validLocalized, 'en')).toBe('Double');
  });
});

// ==================================================================
//  jokerCatalogRowSchema + normalizeJokerCatalogRow
// ==================================================================

describe('jokerCatalogRowSchema', () => {
  it('parse une ligne valide', () => {
    const res = jokerCatalogRowSchema.safeParse(validCatalogRaw);
    expect(res.success).toBe(true);
  });

  it('rejette une catégorie inconnue', () => {
    const res = jokerCatalogRowSchema.safeParse({
      ...validCatalogRaw,
      category: 'unknown',
    });
    expect(res.success).toBe(false);
  });

  it('rejette libelle sans en', () => {
    const res = jokerCatalogRowSchema.safeParse({
      ...validCatalogRaw,
      libelle: { fr: 'Seul' },
    });
    expect(res.success).toBe(false);
  });

  it('rejette description manquante', () => {
    const res = jokerCatalogRowSchema.safeParse({
      ...validCatalogRaw,
      description: null,
    });
    expect(res.success).toBe(false);
  });
});

describe('normalizeJokerCatalogRow', () => {
  it('normalise une ligne valide', () => {
    const row = normalizeJokerCatalogRow(validCatalogRaw);
    expect(row?.code).toBe('double');
    expect(row?.category).toBe('boost');
  });

  it('retourne null si code null', () => {
    const row = normalizeJokerCatalogRow({ ...validCatalogRaw, code: null });
    expect(row).toBeNull();
  });

  it('retourne null si libelle malformé', () => {
    const row = normalizeJokerCatalogRow({
      ...validCatalogRaw,
      libelle: { fr: 'x' },
    });
    expect(row).toBeNull();
  });

  it('coalesce sort_order null en 0', () => {
    const row = normalizeJokerCatalogRow({
      ...validCatalogRaw,
      sort_order: null,
    });
    expect(row?.sort_order).toBe(0);
  });
});

// ==================================================================
//  userJokerRowSchema + normalizeUserJokerRow
// ==================================================================

describe('userJokerRowSchema', () => {
  it('parse un slot owned (used_at null + autres used_* null)', () => {
    const res = userJokerRowSchema.safeParse(validUserJokerRaw);
    expect(res.success).toBe(true);
  });

  it('parse un slot consommé (used_at renseigné)', () => {
    const res = userJokerRowSchema.safeParse({
      ...validUserJokerRaw,
      used_at: '2026-04-25T12:00:00Z',
    });
    expect(res.success).toBe(true);
  });

  it("rejette l'incohérence used_at null + used_on_match_id set (mirror SQL CHECK)", () => {
    const res = userJokerRowSchema.safeParse({
      ...validUserJokerRaw,
      used_at: null,
      used_on_match_id: '44444444-4444-4444-4444-444444444444',
    });
    expect(res.success).toBe(false);
  });

  it("rejette l'incohérence used_at null + used_payload rempli", () => {
    const res = userJokerRowSchema.safeParse({
      ...validUserJokerRaw,
      used_at: null,
      used_payload: { stakes: 5 },
    });
    expect(res.success).toBe(false);
  });

  it('rejette acquired_from inconnu', () => {
    const res = userJokerRowSchema.safeParse({
      ...validUserJokerRaw,
      acquired_from: 'other',
    });
    expect(res.success).toBe(false);
  });
});

describe('normalizeUserJokerRow', () => {
  it('normalise un slot owned', () => {
    const row = normalizeUserJokerRow(validUserJokerRaw);
    expect(row?.joker_code).toBe('double');
    expect(row?.used_at).toBeNull();
  });

  it('retourne null si id manquant', () => {
    const row = normalizeUserJokerRow({ ...validUserJokerRaw, id: null });
    expect(row).toBeNull();
  });

  it('retourne null si user_id manquant', () => {
    const row = normalizeUserJokerRow({ ...validUserJokerRaw, user_id: null });
    expect(row).toBeNull();
  });

  it('retourne null si joker_code manquant', () => {
    const row = normalizeUserJokerRow({
      ...validUserJokerRaw,
      joker_code: null,
    });
    expect(row).toBeNull();
  });

  it('coerce used_payload array en null (objets uniquement)', () => {
    const row = normalizeUserJokerRow({
      ...validUserJokerRaw,
      used_at: '2026-04-25T00:00:00Z',
      used_payload: [1, 2, 3] as unknown as Record<string, unknown>,
    });
    expect(row?.used_payload).toBeNull();
  });

  it('garde un used_payload objet tel quel', () => {
    const row = normalizeUserJokerRow({
      ...validUserJokerRaw,
      used_at: '2026-04-25T00:00:00Z',
      used_payload: { stakes: 5 } as unknown as Record<string, unknown>,
    });
    expect(row?.used_payload).toEqual({ stakes: 5 });
  });
});

// ==================================================================
//  isJokerOwned
// ==================================================================

describe('isJokerOwned', () => {
  it('true si used_at null', () => {
    const parsed = userJokerRowSchema.parse(validUserJokerRaw);
    expect(isJokerOwned(parsed)).toBe(true);
  });

  it('false si used_at renseigné', () => {
    const parsed = userJokerRowSchema.parse({
      ...validUserJokerRaw,
      used_at: '2026-04-25T12:00:00Z',
    });
    expect(isJokerOwned(parsed)).toBe(false);
  });
});

// ==================================================================
//  userJokerWithCatalogSchema + normalizeUserJokerWithCatalog
// ==================================================================

describe('userJokerWithCatalogSchema', () => {
  it('parse une ligne jointe valide', () => {
    const res = userJokerWithCatalogSchema.safeParse({
      ...validUserJokerRaw,
      joker: jokerCatalogRowSchema.parse(validCatalogRaw),
    });
    expect(res.success).toBe(true);
  });
});

describe('normalizeUserJokerWithCatalog', () => {
  it('normalise un objet joint (embed object)', () => {
    const row = normalizeUserJokerWithCatalog({
      ...validUserJokerRaw,
      joker: validCatalogRaw,
    });
    expect(row?.joker_code).toBe('double');
    expect(row?.joker.category).toBe('boost');
  });

  it('normalise un array (embed array côté Supabase)', () => {
    const row = normalizeUserJokerWithCatalog({
      ...validUserJokerRaw,
      joker: [validCatalogRaw],
    });
    expect(row?.joker.code).toBe('double');
  });

  it('retourne null si joker absent', () => {
    const row = normalizeUserJokerWithCatalog({
      ...validUserJokerRaw,
      joker: null,
    });
    expect(row).toBeNull();
  });

  it('retourne null si user_joker part invalide', () => {
    const row = normalizeUserJokerWithCatalog({
      ...validUserJokerRaw,
      id: null,
      joker: validCatalogRaw,
    });
    expect(row).toBeNull();
  });

  it('retourne null si catalog part invalide', () => {
    const row = normalizeUserJokerWithCatalog({
      ...validUserJokerRaw,
      joker: { ...validCatalogRaw, libelle: { fr: 'seul' } },
    });
    expect(row).toBeNull();
  });
});

// ==================================================================
//  compareJokerCatalog
// ==================================================================

describe('compareJokerCatalog', () => {
  const make = (over: Partial<JokerCatalogRow>): JokerCatalogRow => ({
    code: 'x',
    category: 'boost',
    libelle: validLocalized,
    description: validLocalized,
    icon: 'Flame',
    sort_order: 0,
    ...over,
  });

  it('trie boost avant info, info avant social', () => {
    const boost = make({ code: 'boost', category: 'boost' });
    const info = make({ code: 'info', category: 'info' });
    const social = make({ code: 'social', category: 'social' });
    expect(compareJokerCatalog(boost, info)).toBeLessThan(0);
    expect(compareJokerCatalog(info, social)).toBeLessThan(0);
  });

  it('à catégorie égale, trie par sort_order asc', () => {
    const a = make({ code: 'a', sort_order: 10 });
    const b = make({ code: 'b', sort_order: 20 });
    expect(compareJokerCatalog(a, b)).toBeLessThan(0);
  });

  it('fallback : trie par code asc', () => {
    const a = make({ code: 'aaa', sort_order: 10 });
    const b = make({ code: 'bbb', sort_order: 10 });
    expect(compareJokerCatalog(a, b)).toBeLessThan(0);
  });
});

// ==================================================================
//  compareUserJokerForInventory
// ==================================================================

describe('compareUserJokerForInventory', () => {
  const makeSlot = (over: {
    id?: string;
    used_at?: string | null;
    acquired_at?: string;
    category?: 'boost' | 'info' | 'challenge' | 'social';
    code?: string;
    sort_order?: number;
  }): UserJokerWithCatalog => {
    const {
      id = SLOT,
      used_at = null,
      acquired_at = '2026-04-22T10:00:00Z',
      category = 'boost',
      code = 'double',
      sort_order = 10,
    } = over;
    return {
      id,
      user_id: USER,
      concours_id: CONCOURS,
      joker_code: code,
      acquired_from: 'starter',
      acquired_at,
      used_at,
      used_on_match_id: null,
      used_on_target_user_id: null,
      used_payload: null,
      joker: {
        code,
        category,
        libelle: validLocalized,
        description: validLocalized,
        icon: 'Flame',
        sort_order,
      },
    };
  };

  it('owned (used_at null) avant used', () => {
    const owned = makeSlot({ id: 'a' });
    const used = makeSlot({ id: 'b', used_at: '2026-04-25T00:00:00Z' });
    expect(compareUserJokerForInventory(owned, used)).toBeLessThan(0);
  });

  it('à statut égal, respecte compareJokerCatalog', () => {
    const boost = makeSlot({ id: 'a', category: 'boost' });
    const social = makeSlot({ id: 'b', category: 'social' });
    expect(compareUserJokerForInventory(boost, social)).toBeLessThan(0);
  });

  it('tie-break sur acquired_at desc (plus récent d abord)', () => {
    const recent = makeSlot({
      id: 'a',
      acquired_at: '2026-04-25T00:00:00Z',
    });
    const older = makeSlot({
      id: 'b',
      acquired_at: '2026-04-01T00:00:00Z',
    });
    expect(compareUserJokerForInventory(recent, older)).toBeLessThan(0);
  });
});
