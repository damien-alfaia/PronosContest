import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Builder Supabase minimal (pattern aligné sur classement/pronos).
 * On stocke `mockResponse` pour piloter data/error depuis chaque test,
 * et `calls` pour asserter la chaîne d'appels.
 */

type SupaResponse<T = unknown> = {
  data: T;
  error: { code?: string; message: string } | null;
  count?: number | null;
};

let mockResponse: SupaResponse = { data: null, error: null };
const calls: Array<{ op: string; args: unknown[] }> = [];

const record = (op: string, ...args: unknown[]) => calls.push({ op, args });

const makeBuilder = () => {
  const builder: Record<string, unknown> = {};
  const chain =
    (op: string) =>
    (...args: unknown[]) => {
      record(op, ...args);
      return builder;
    };

  for (const op of ['select', 'eq', 'order', 'limit', 'in']) {
    builder[op] = chain(op);
  }

  builder.single = vi.fn(async () => mockResponse);
  (builder as { then: (fn: (r: SupaResponse) => void) => void }).then = (fn) =>
    Promise.resolve(mockResponse).then(fn);

  return builder;
};

vi.mock('@/lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn((table: string) => {
        record('from', table);
        return makeBuilder();
      }),
    },
  };
});

import {
  countUserBadges,
  listBadgesCatalog,
  listUserBadges,
} from '@/features/badges/api';

const USER = '11111111-1111-1111-1111-111111111111';

const validCatalogRaw = {
  code: 'pronostic_parfait',
  category: 'skill',
  tier: 'silver',
  libelle: { fr: 'Parfait', en: 'Perfect' },
  description: { fr: 'Score exact', en: 'Exact score' },
  icon: 'Target',
  sort_order: 30,
};

beforeEach(() => {
  calls.length = 0;
  mockResponse = { data: null, error: null };
});

// ==================================================================
//  listBadgesCatalog
// ==================================================================

describe('listBadgesCatalog', () => {
  it('requête badges triée par sort_order asc', async () => {
    mockResponse = { data: [], error: null };
    await listBadgesCatalog();

    expect(
      calls.some((c) => c.op === 'from' && c.args[0] === 'badges'),
    ).toBe(true);
    const orders = calls.filter((c) => c.op === 'order');
    expect(orders[0]).toMatchObject({
      args: ['sort_order', { ascending: true }],
    });
  });

  it('normalise les lignes valides, ignore les cassées', async () => {
    mockResponse = {
      data: [
        validCatalogRaw,
        // Invalide : libelle tronqué
        { ...validCatalogRaw, code: 'broken', libelle: { fr: 'x' } },
        // Invalide : code null
        { ...validCatalogRaw, code: null },
      ],
      error: null,
    };

    const rows = await listBadgesCatalog();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.code).toBe('pronostic_parfait');
  });

  it('retourne [] si data est null', async () => {
    mockResponse = { data: null, error: null };
    const rows = await listBadgesCatalog();
    expect(rows).toEqual([]);
  });

  it('propage une erreur Supabase', async () => {
    mockResponse = { data: null, error: { message: 'network' } };
    await expect(listBadgesCatalog()).rejects.toMatchObject({
      message: 'network',
    });
  });
});

// ==================================================================
//  listUserBadges
// ==================================================================

describe('listUserBadges', () => {
  it('filtre sur user_id + order earned_at desc + select nested badge', async () => {
    mockResponse = { data: [], error: null };
    await listUserBadges(USER);

    expect(
      calls.some((c) => c.op === 'from' && c.args[0] === 'user_badges'),
    ).toBe(true);

    // Le select doit référencer le join badges(...)
    const selects = calls.filter((c) => c.op === 'select');
    expect(selects[0]?.args[0]).toMatch(/badge:badges/);

    const eqs = calls.filter((c) => c.op === 'eq');
    expect(eqs).toHaveLength(1);
    expect(eqs[0]).toMatchObject({ args: ['user_id', USER] });

    const orders = calls.filter((c) => c.op === 'order');
    expect(orders[0]).toMatchObject({
      args: ['earned_at', { ascending: false }],
    });
  });

  it('normalise les lignes jointes valides et filtre les cassées', async () => {
    mockResponse = {
      data: [
        {
          user_id: USER,
          badge_code: 'pronostic_parfait',
          earned_at: '2026-04-20T12:00:00Z',
          metadata: {},
          badge: validCatalogRaw,
        },
        // Invalide : badge absent
        {
          user_id: USER,
          badge_code: 'rookie',
          earned_at: '2026-04-21T12:00:00Z',
          metadata: {},
          badge: null,
        },
      ],
      error: null,
    };

    const rows = await listUserBadges(USER);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.badge.code).toBe('pronostic_parfait');
  });

  it('propage une erreur RLS', async () => {
    mockResponse = { data: null, error: { code: '42501', message: 'rls' } };
    await expect(listUserBadges(USER)).rejects.toMatchObject({ code: '42501' });
  });
});

// ==================================================================
//  countUserBadges
// ==================================================================

describe('countUserBadges', () => {
  it('utilise select count+head sur user_badges filtré par user_id', async () => {
    mockResponse = { data: null, error: null, count: 7 };
    const n = await countUserBadges(USER);

    expect(n).toBe(7);
    expect(
      calls.some((c) => c.op === 'from' && c.args[0] === 'user_badges'),
    ).toBe(true);

    // Assert le 2e arg de select (options { count: 'exact', head: true })
    const selects = calls.filter((c) => c.op === 'select');
    expect(selects[0]?.args[1]).toMatchObject({
      count: 'exact',
      head: true,
    });

    const eqs = calls.filter((c) => c.op === 'eq');
    expect(eqs[0]).toMatchObject({ args: ['user_id', USER] });
  });

  it('retourne 0 si count null', async () => {
    mockResponse = { data: null, error: null, count: null };
    const n = await countUserBadges(USER);
    expect(n).toBe(0);
  });

  it('propage une erreur', async () => {
    mockResponse = { data: null, error: { message: 'boom' } };
    await expect(countUserBadges(USER)).rejects.toMatchObject({
      message: 'boom',
    });
  });
});
