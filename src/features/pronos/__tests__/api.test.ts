import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Même builder chainable que pour `concours/api.test` :
 * - méthodes de chaînage → retournent le builder,
 * - terminaisons (`await`, `single`, `maybeSingle`) → `mockResponse`,
 * - `calls` capture toutes les opérations pour assertion.
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
  deleteProno,
  listMatchsByCompetition,
  listMyPronosInConcours,
  listPronosForMatchInConcours,
  upsertProno,
} from '@/features/pronos/api';
import type { UpsertPronoInput } from '@/features/pronos/schemas';

const CONCOURS = '11111111-1111-1111-1111-111111111111';
const COMPETITION = '22222222-2222-2222-2222-222222222222';
const MATCH = '33333333-3333-3333-3333-333333333333';
const USER = '44444444-4444-4444-4444-444444444444';

beforeEach(() => {
  calls.length = 0;
  mockResponse = { data: null, error: null };
});

// ------------------------------------------------------------------
//  MATCHS
// ------------------------------------------------------------------

describe('listMatchsByCompetition', () => {
  it('requête la table matchs avec filtre competition_id + ordre chronologique', async () => {
    mockResponse = { data: [], error: null };
    await listMatchsByCompetition(COMPETITION);

    expect(calls.some((c) => c.op === 'from' && c.args[0] === 'matchs')).toBe(true);
    expect(calls.some((c) => c.op === 'eq' && c.args[0] === 'competition_id' && c.args[1] === COMPETITION)).toBe(
      true,
    );
    const order = calls.find((c) => c.op === 'order');
    expect(order).toBeDefined();
    expect(order?.args[0]).toBe('kick_off_at');
    expect(order?.args[1]).toMatchObject({ ascending: true });
  });

  it('utilise la désambiguïsation FK equipes!matchs_equipe_a_id_fkey / _b_id_fkey', async () => {
    mockResponse = { data: [], error: null };
    await listMatchsByCompetition(COMPETITION);

    const select = calls.find((c) => c.op === 'select');
    expect(select).toBeDefined();
    const selectStr = select?.args[0] as string;
    expect(selectStr).toContain('matchs_equipe_a_id_fkey');
    expect(selectStr).toContain('matchs_equipe_b_id_fkey');
  });

  it('remonte une erreur Supabase', async () => {
    mockResponse = { data: null, error: { message: 'boom' } };
    await expect(listMatchsByCompetition(COMPETITION)).rejects.toMatchObject({
      message: 'boom',
    });
  });

  it('retourne [] si data est null', async () => {
    mockResponse = { data: null, error: null };
    const result = await listMatchsByCompetition(COMPETITION);
    expect(result).toEqual([]);
  });
});

// ------------------------------------------------------------------
//  PRONOS — lecture
// ------------------------------------------------------------------

describe('listMyPronosInConcours', () => {
  it('requête pronos avec filtre concours_id (RLS gère le user_id)', async () => {
    mockResponse = { data: [], error: null };
    await listMyPronosInConcours(CONCOURS);

    expect(calls.some((c) => c.op === 'from' && c.args[0] === 'pronos')).toBe(true);
    expect(
      calls.some((c) => c.op === 'eq' && c.args[0] === 'concours_id' && c.args[1] === CONCOURS),
    ).toBe(true);
  });

  it('propage une erreur', async () => {
    mockResponse = { data: null, error: { message: 'rls' } };
    await expect(listMyPronosInConcours(CONCOURS)).rejects.toMatchObject({
      message: 'rls',
    });
  });
});

describe('listPronosForMatchInConcours', () => {
  it('filtre sur concours_id + match_id', async () => {
    mockResponse = { data: [], error: null };
    await listPronosForMatchInConcours(CONCOURS, MATCH);

    const eqs = calls.filter((c) => c.op === 'eq');
    expect(eqs).toHaveLength(2);
    expect(eqs[0]).toMatchObject({ args: ['concours_id', CONCOURS] });
    expect(eqs[1]).toMatchObject({ args: ['match_id', MATCH] });
  });
});

// ------------------------------------------------------------------
//  PRONOS — mutations
// ------------------------------------------------------------------

describe('upsertProno', () => {
  const sampleInput: UpsertPronoInput = {
    concours_id: CONCOURS,
    match_id: MATCH,
    phase: 'groupes',
    score_a: 2,
    score_b: 1,
    vainqueur_tab: null,
  };

  const sampleRow = {
    concours_id: CONCOURS,
    user_id: USER,
    match_id: MATCH,
    score_a: 2,
    score_b: 1,
    vainqueur_tab: null,
    created_at: '2026-06-11T10:00:00Z',
    updated_at: '2026-06-11T10:00:00Z',
  };

  it('envoie un payload sans la phase (pas de colonne phase sur pronos)', async () => {
    mockResponse = { data: sampleRow, error: null };

    await upsertProno(USER, sampleInput);

    const upsert = calls.find((c) => c.op === 'upsert');
    expect(upsert).toBeDefined();
    const payload = upsert?.args[0] as Record<string, unknown>;
    expect(payload).toEqual({
      concours_id: CONCOURS,
      user_id: USER,
      match_id: MATCH,
      score_a: 2,
      score_b: 1,
      vainqueur_tab: null,
    });
    expect(payload).not.toHaveProperty('phase');
  });

  it('utilise onConflict sur la PK composite', async () => {
    mockResponse = { data: sampleRow, error: null };

    await upsertProno(USER, sampleInput);

    const upsert = calls.find((c) => c.op === 'upsert');
    expect(upsert?.args[1]).toMatchObject({
      onConflict: 'concours_id,user_id,match_id',
    });
  });

  it("propage une erreur RLS (42501)", async () => {
    mockResponse = { data: null, error: { code: '42501', message: 'rls' } };
    await expect(upsertProno(USER, sampleInput)).rejects.toMatchObject({
      code: '42501',
    });
  });
});

describe('deleteProno', () => {
  it('filtre sur (concours_id, user_id, match_id)', async () => {
    mockResponse = { data: null, error: null };

    await deleteProno(USER, { concours_id: CONCOURS, match_id: MATCH });

    expect(calls.some((c) => c.op === 'delete')).toBe(true);
    const eqs = calls.filter((c) => c.op === 'eq');
    expect(eqs).toHaveLength(3);
    expect(eqs[0]).toMatchObject({ args: ['concours_id', CONCOURS] });
    expect(eqs[1]).toMatchObject({ args: ['user_id', USER] });
    expect(eqs[2]).toMatchObject({ args: ['match_id', MATCH] });
  });

  it('est idempotent : pas d’erreur si rien à supprimer', async () => {
    mockResponse = { data: null, error: null };
    await expect(
      deleteProno(USER, { concours_id: CONCOURS, match_id: MATCH }),
    ).resolves.toBeUndefined();
  });

  it('propage une erreur Supabase', async () => {
    mockResponse = { data: null, error: { message: 'boom' } };
    await expect(
      deleteProno(USER, { concours_id: CONCOURS, match_id: MATCH }),
    ).rejects.toMatchObject({ message: 'boom' });
  });
});
