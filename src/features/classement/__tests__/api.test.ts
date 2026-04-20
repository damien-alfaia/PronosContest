import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Builder Supabase minimal (aligné sur celui de `pronos` / `concours`) :
 *  - méthodes de chaînage → retournent le builder,
 *  - `await builder` / `.single()` → utilisent `mockResponse`,
 *  - `calls` capture toutes les opérations pour assertion.
 */

type SupaResponse<T = unknown> = {
  data: T;
  error: { code?: string; message: string } | null;
};

let mockResponse: SupaResponse = { data: null, error: null };
const calls: Array<{ op: string; args: unknown[] }> = [];

const record = (op: string, ...args: unknown[]) => calls.push({ op, args });

const makeBuilder = () => {
  const builder: Record<string, unknown> = {};
  const chain = (op: string) =>
    (...args: unknown[]) => {
      record(op, ...args);
      return builder;
    };

  for (const op of [
    'select',
    'insert',
    'update',
    'delete',
    'upsert',
    'eq',
    'neq',
    'ilike',
    'like',
    'in',
    'is',
    'order',
    'range',
    'limit',
    'filter',
    'or',
  ]) {
    builder[op] = chain(op);
  }

  builder.single = vi.fn(async () => mockResponse);
  builder.maybeSingle = vi.fn(async () => mockResponse);
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
  listAllPronosPointsInConcours,
  listClassement,
  listPronosPointsForUser,
} from '@/features/classement/api';

const CONCOURS = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';
const MATCH = '33333333-3333-3333-3333-333333333333';

beforeEach(() => {
  calls.length = 0;
  mockResponse = { data: null, error: null };
});

// ------------------------------------------------------------------
//  listClassement
// ------------------------------------------------------------------

describe('listClassement', () => {
  it('requête v_classement_concours filtré par concours_id + order rang', async () => {
    mockResponse = { data: [], error: null };
    await listClassement(CONCOURS);

    expect(
      calls.some(
        (c) => c.op === 'from' && c.args[0] === 'v_classement_concours',
      ),
    ).toBe(true);
    expect(
      calls.some(
        (c) => c.op === 'eq' && c.args[0] === 'concours_id' && c.args[1] === CONCOURS,
      ),
    ).toBe(true);

    const orders = calls.filter((c) => c.op === 'order');
    expect(orders.length).toBeGreaterThanOrEqual(1);
    expect(orders[0]).toMatchObject({
      args: ['rang', { ascending: true }],
    });
  });

  it('normalise les lignes (coalesce null → 0 / 1)', async () => {
    mockResponse = {
      data: [
        {
          concours_id: CONCOURS,
          user_id: USER,
          rang: null,
          points: null,
          pronos_joues: null,
          pronos_gagnes: null,
          pronos_exacts: null,
          prenom: null,
          nom: null,
          avatar_url: null,
        },
      ],
      error: null,
    };

    const rows = await listClassement(CONCOURS);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.rang).toBe(1);
    expect(rows[0]?.points).toBe(0);
  });

  it('ignore les lignes invalides (user_id manquant)', async () => {
    mockResponse = {
      data: [
        {
          concours_id: CONCOURS,
          user_id: null,
          rang: 1,
          points: 0,
          pronos_joues: 0,
          pronos_gagnes: 0,
          pronos_exacts: 0,
          prenom: null,
          nom: null,
          avatar_url: null,
        },
        {
          concours_id: CONCOURS,
          user_id: USER,
          rang: 1,
          points: 0,
          pronos_joues: 0,
          pronos_gagnes: 0,
          pronos_exacts: 0,
          prenom: 'A',
          nom: 'B',
          avatar_url: null,
        },
      ],
      error: null,
    };

    const rows = await listClassement(CONCOURS);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.user_id).toBe(USER);
  });

  it('retourne [] si data est null', async () => {
    mockResponse = { data: null, error: null };
    const rows = await listClassement(CONCOURS);
    expect(rows).toEqual([]);
  });

  it('propage une erreur Supabase', async () => {
    mockResponse = { data: null, error: { message: 'boom' } };
    await expect(listClassement(CONCOURS)).rejects.toMatchObject({
      message: 'boom',
    });
  });
});

// ------------------------------------------------------------------
//  listPronosPointsForUser
// ------------------------------------------------------------------

describe('listPronosPointsForUser', () => {
  it('filtre sur concours_id + user_id + is_final=true', async () => {
    mockResponse = { data: [], error: null };
    await listPronosPointsForUser(CONCOURS, USER);

    expect(
      calls.some((c) => c.op === 'from' && c.args[0] === 'v_pronos_points'),
    ).toBe(true);

    const eqs = calls.filter((c) => c.op === 'eq');
    expect(eqs).toHaveLength(3);
    expect(eqs[0]).toMatchObject({ args: ['concours_id', CONCOURS] });
    expect(eqs[1]).toMatchObject({ args: ['user_id', USER] });
    expect(eqs[2]).toMatchObject({ args: ['is_final', true] });
  });

  it('normalise et filtre les lignes valides', async () => {
    mockResponse = {
      data: [
        {
          concours_id: CONCOURS,
          user_id: USER,
          match_id: MATCH,
          phase: 'groupes',
          match_status: 'finished',
          is_final: true,
          is_exact: true,
          points_base: 3,
          bonus_ko: 0,
          cote_appliquee: null,
        },
        {
          // Invalide : match_id null
          concours_id: CONCOURS,
          user_id: USER,
          match_id: null,
          phase: 'groupes',
          match_status: 'finished',
          is_final: true,
          is_exact: false,
          points_base: 0,
          bonus_ko: 0,
          cote_appliquee: null,
        },
      ],
      error: null,
    };

    const rows = await listPronosPointsForUser(CONCOURS, USER);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.match_id).toBe(MATCH);
  });

  it('propage une erreur RLS', async () => {
    mockResponse = { data: null, error: { code: '42501', message: 'rls' } };
    await expect(listPronosPointsForUser(CONCOURS, USER)).rejects.toMatchObject(
      { code: '42501' },
    );
  });
});

// ------------------------------------------------------------------
//  listAllPronosPointsInConcours
// ------------------------------------------------------------------

describe('listAllPronosPointsInConcours', () => {
  it('filtre sur concours_id + is_final=true (pas de user_id)', async () => {
    mockResponse = { data: [], error: null };
    await listAllPronosPointsInConcours(CONCOURS);

    expect(
      calls.some((c) => c.op === 'from' && c.args[0] === 'v_pronos_points'),
    ).toBe(true);

    const eqs = calls.filter((c) => c.op === 'eq');
    expect(eqs).toHaveLength(2);
    expect(eqs[0]).toMatchObject({ args: ['concours_id', CONCOURS] });
    expect(eqs[1]).toMatchObject({ args: ['is_final', true] });
    expect(eqs.some((c) => c.args[0] === 'user_id')).toBe(false);
  });

  it('retourne [] si data est null', async () => {
    mockResponse = { data: null, error: null };
    const rows = await listAllPronosPointsInConcours(CONCOURS);
    expect(rows).toEqual([]);
  });
});
