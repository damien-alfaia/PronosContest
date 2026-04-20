import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests admin/matchs/api.ts
 *
 * Builder Supabase minimal aligné sur `classement/__tests__/api.test.ts` :
 *   - toutes les méthodes de chaînage retournent le builder,
 *   - `single()` / `await builder` utilisent `mockResponse`,
 *   - `calls` capture les opérations pour assertions.
 *
 * Mutations → on vérifie :
 *   - table ciblée (`from('matchs')`),
 *   - payload de `update({...})` (seules les colonnes attendues),
 *   - filtre `.eq('id', match_id)`,
 *   - propagation des erreurs Supabase.
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
  const chain =
    (op: string) =>
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
  listAdminMatchsByCompetition,
  listEquipesForCompetition,
  resetMatchResult,
  updateMatchResult,
  updateMatchStatus,
  updateMatchTeams,
} from '@/features/admin/matchs/api';

const COMP = 'comp-00000000-0000-0000-0000-000000000001';
const MATCH = 'match-0000-0000-0000-0000-000000000001';
const EQA = 'eqa-00000000-0000-0000-0000-000000000001';
const EQB = 'eqb-00000000-0000-0000-0000-000000000001';

beforeEach(() => {
  calls.length = 0;
  mockResponse = { data: null, error: null };
});

// ------------------------------------------------------------------
//  listAdminMatchsByCompetition
// ------------------------------------------------------------------

describe('listAdminMatchsByCompetition', () => {
  it('tape matchs + filtre competition_id + order kick_off_at asc', async () => {
    mockResponse = { data: [], error: null };
    await listAdminMatchsByCompetition(COMP);

    expect(
      calls.some((c) => c.op === 'from' && c.args[0] === 'matchs'),
    ).toBe(true);
    expect(
      calls.some(
        (c) =>
          c.op === 'eq' && c.args[0] === 'competition_id' && c.args[1] === COMP,
      ),
    ).toBe(true);
    const order = calls.find((c) => c.op === 'order');
    expect(order).toMatchObject({
      args: ['kick_off_at', { ascending: true }],
    });
  });

  it('désambigue les relations equipes via les noms de contraintes FK', async () => {
    mockResponse = { data: [], error: null };
    await listAdminMatchsByCompetition(COMP);
    const select = calls.find((c) => c.op === 'select');
    expect(select).toBeDefined();
    const raw = String(select?.args[0] ?? '');
    expect(raw).toContain('equipes!matchs_equipe_a_id_fkey');
    expect(raw).toContain('equipes!matchs_equipe_b_id_fkey');
  });

  it('retourne [] si data est null', async () => {
    mockResponse = { data: null, error: null };
    const rows = await listAdminMatchsByCompetition(COMP);
    expect(rows).toEqual([]);
  });

  it('propage une erreur Supabase', async () => {
    mockResponse = { data: null, error: { code: '42501', message: 'rls' } };
    await expect(listAdminMatchsByCompetition(COMP)).rejects.toMatchObject({
      code: '42501',
    });
  });
});

// ------------------------------------------------------------------
//  listEquipesForCompetition
// ------------------------------------------------------------------

describe('listEquipesForCompetition', () => {
  it('tape equipes + filtre competition_id + order groupe puis nom', async () => {
    mockResponse = { data: [], error: null };
    await listEquipesForCompetition(COMP);

    expect(
      calls.some((c) => c.op === 'from' && c.args[0] === 'equipes'),
    ).toBe(true);
    expect(
      calls.some(
        (c) =>
          c.op === 'eq' && c.args[0] === 'competition_id' && c.args[1] === COMP,
      ),
    ).toBe(true);

    const orders = calls.filter((c) => c.op === 'order');
    expect(orders).toHaveLength(2);
    expect(orders[0]).toMatchObject({
      args: ['groupe', { ascending: true, nullsFirst: false }],
    });
    expect(orders[1]).toMatchObject({
      args: ['nom', { ascending: true }],
    });
  });

  it('retourne [] si data est null', async () => {
    mockResponse = { data: null, error: null };
    const rows = await listEquipesForCompetition(COMP);
    expect(rows).toEqual([]);
  });
});

// ------------------------------------------------------------------
//  updateMatchTeams
// ------------------------------------------------------------------

describe('updateMatchTeams', () => {
  it('update matchs avec equipe_a_id / equipe_b_id filtré par id', async () => {
    mockResponse = { data: { id: MATCH }, error: null };
    await updateMatchTeams({
      match_id: MATCH,
      equipe_a_id: EQA,
      equipe_b_id: EQB,
    });

    const update = calls.find((c) => c.op === 'update');
    expect(update?.args[0]).toEqual({
      equipe_a_id: EQA,
      equipe_b_id: EQB,
    });
    expect(
      calls.some(
        (c) => c.op === 'eq' && c.args[0] === 'id' && c.args[1] === MATCH,
      ),
    ).toBe(true);
  });

  it('accepte null pour désassigner', async () => {
    mockResponse = { data: { id: MATCH }, error: null };
    await updateMatchTeams({
      match_id: MATCH,
      equipe_a_id: null,
      equipe_b_id: null,
    });
    const update = calls.find((c) => c.op === 'update');
    expect(update?.args[0]).toEqual({
      equipe_a_id: null,
      equipe_b_id: null,
    });
  });

  it('propage l’erreur trigger finished match', async () => {
    mockResponse = {
      data: null,
      error: { code: '23514', message: 'finished match' },
    };
    await expect(
      updateMatchTeams({
        match_id: MATCH,
        equipe_a_id: EQA,
        equipe_b_id: EQB,
      }),
    ).rejects.toMatchObject({ message: 'finished match' });
  });
});

// ------------------------------------------------------------------
//  updateMatchResult
// ------------------------------------------------------------------

describe('updateMatchResult', () => {
  it('écrit score_a/b + vainqueur_tab + pénos + status', async () => {
    mockResponse = { data: { id: MATCH }, error: null };
    await updateMatchResult({
      match_id: MATCH,
      phase: 'finale',
      score_a: 1,
      score_b: 1,
      vainqueur_tab: 'a',
      penalty_score_a: 5,
      penalty_score_b: 4,
      status: 'finished',
    });

    const update = calls.find((c) => c.op === 'update');
    expect(update?.args[0]).toEqual({
      score_a: 1,
      score_b: 1,
      vainqueur_tab: 'a',
      penalty_score_a: 5,
      penalty_score_b: 4,
      status: 'finished',
    });

    expect(
      calls.some(
        (c) => c.op === 'eq' && c.args[0] === 'id' && c.args[1] === MATCH,
      ),
    ).toBe(true);
  });

  it('accepte status=live (score affiché sans figer le scoring)', async () => {
    mockResponse = { data: { id: MATCH }, error: null };
    await updateMatchResult({
      match_id: MATCH,
      phase: 'groupes',
      score_a: 2,
      score_b: 0,
      vainqueur_tab: null,
      penalty_score_a: null,
      penalty_score_b: null,
      status: 'live',
    });
    const update = calls.find((c) => c.op === 'update');
    expect((update?.args[0] as { status: string }).status).toBe('live');
  });

  it('propage une erreur Supabase', async () => {
    mockResponse = { data: null, error: { message: 'boom' } };
    await expect(
      updateMatchResult({
        match_id: MATCH,
        phase: 'groupes',
        score_a: 1,
        score_b: 0,
        vainqueur_tab: null,
        penalty_score_a: null,
        penalty_score_b: null,
        status: 'finished',
      }),
    ).rejects.toMatchObject({ message: 'boom' });
  });
});

// ------------------------------------------------------------------
//  updateMatchStatus
// ------------------------------------------------------------------

describe('updateMatchStatus', () => {
  it('update seulement status', async () => {
    mockResponse = { data: { id: MATCH }, error: null };
    await updateMatchStatus({ match_id: MATCH, status: 'postponed' });

    const update = calls.find((c) => c.op === 'update');
    expect(update?.args[0]).toEqual({ status: 'postponed' });
    expect(
      calls.some(
        (c) => c.op === 'eq' && c.args[0] === 'id' && c.args[1] === MATCH,
      ),
    ).toBe(true);
  });

  it('accepte cancelled / scheduled', async () => {
    for (const s of ['cancelled', 'scheduled'] as const) {
      calls.length = 0;
      mockResponse = { data: { id: MATCH }, error: null };
      await updateMatchStatus({ match_id: MATCH, status: s });
      const update = calls.find((c) => c.op === 'update');
      expect(update?.args[0]).toEqual({ status: s });
    }
  });
});

// ------------------------------------------------------------------
//  resetMatchResult
// ------------------------------------------------------------------

describe('resetMatchResult', () => {
  it('nettoie scores + pénos + vainqueur_tab, remet status=scheduled', async () => {
    mockResponse = { data: { id: MATCH }, error: null };
    await resetMatchResult(MATCH);

    const update = calls.find((c) => c.op === 'update');
    expect(update?.args[0]).toEqual({
      score_a: null,
      score_b: null,
      vainqueur_tab: null,
      penalty_score_a: null,
      penalty_score_b: null,
      status: 'scheduled',
    });
    expect(
      calls.some(
        (c) => c.op === 'eq' && c.args[0] === 'id' && c.args[1] === MATCH,
      ),
    ).toBe(true);
  });

  it('propage une erreur Supabase', async () => {
    mockResponse = { data: null, error: { message: 'boom' } };
    await expect(resetMatchResult(MATCH)).rejects.toMatchObject({
      message: 'boom',
    });
  });
});
