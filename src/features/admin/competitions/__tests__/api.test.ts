import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests admin/competitions/api.ts
 *
 * Builder Supabase mocké (même pattern que admin/matchs/__tests__/api.test.ts) :
 *   - toutes les méthodes de chaînage retournent le builder,
 *   - `single()` / `await builder` utilisent `mockResponse`,
 *   - `calls` capture les opérations pour assertions.
 *
 * On valide pour chaque fonction :
 *   - table ciblée (`competitions`),
 *   - payload de `insert` / `update` (colonnes exactes),
 *   - filtre `.eq('id', ...)` pour les mutations ciblées,
 *   - l'ordre de tri pour la lecture,
 *   - la propagation des erreurs Supabase (RLS, FK RESTRICT, UNIQUE).
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
  createCompetition,
  deleteCompetition,
  listCompetitionsAdmin,
  updateCompetition,
} from '@/features/admin/competitions/api';
import type { CompetitionUpsertInput } from '@/features/admin/competitions/schemas';

const COMP_ID = '22222222-0000-0000-0000-000000000001';

const validInput: CompetitionUpsertInput = {
  code: 'fifa-wc-2026',
  nom: 'FIFA World Cup 2026',
  sport: 'football',
  status: 'upcoming',
  date_debut: '2026-06-11',
  date_fin: '2026-07-19',
  logo_url: 'https://example.com/logo.png',
};

beforeEach(() => {
  calls.length = 0;
  mockResponse = { data: null, error: null };
});

// ------------------------------------------------------------------
//  listCompetitionsAdmin
// ------------------------------------------------------------------

describe('listCompetitionsAdmin', () => {
  it('tape competitions + order date_debut desc puis nom asc', async () => {
    mockResponse = { data: [], error: null };
    await listCompetitionsAdmin();

    expect(
      calls.some((c) => c.op === 'from' && c.args[0] === 'competitions'),
    ).toBe(true);

    const orders = calls.filter((c) => c.op === 'order');
    expect(orders).toHaveLength(2);
    expect(orders[0]).toMatchObject({
      args: ['date_debut', { ascending: false, nullsFirst: false }],
    });
    expect(orders[1]).toMatchObject({
      args: ['nom', { ascending: true }],
    });
  });

  it('retourne [] si data est null', async () => {
    mockResponse = { data: null, error: null };
    const rows = await listCompetitionsAdmin();
    expect(rows).toEqual([]);
  });

  it('propage une erreur RLS Supabase (42501)', async () => {
    mockResponse = { data: null, error: { code: '42501', message: 'rls' } };
    await expect(listCompetitionsAdmin()).rejects.toMatchObject({
      code: '42501',
    });
  });
});

// ------------------------------------------------------------------
//  createCompetition
// ------------------------------------------------------------------

describe('createCompetition', () => {
  it('insert payload complet sur competitions', async () => {
    mockResponse = { data: { id: COMP_ID }, error: null };
    await createCompetition(validInput);

    expect(
      calls.some((c) => c.op === 'from' && c.args[0] === 'competitions'),
    ).toBe(true);

    const insert = calls.find((c) => c.op === 'insert');
    expect(insert?.args[0]).toEqual({
      code: validInput.code,
      nom: validInput.nom,
      sport: validInput.sport,
      status: validInput.status,
      date_debut: validInput.date_debut,
      date_fin: validInput.date_fin,
      logo_url: validInput.logo_url,
    });
  });

  it('propage une erreur UNIQUE 23505 (code déjà pris)', async () => {
    mockResponse = {
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    };
    await expect(createCompetition(validInput)).rejects.toMatchObject({
      code: '23505',
    });
  });
});

// ------------------------------------------------------------------
//  updateCompetition
// ------------------------------------------------------------------

describe('updateCompetition', () => {
  it('update payload complet + filtre eq(id, ...)', async () => {
    mockResponse = { data: { id: COMP_ID }, error: null };
    await updateCompetition({ id: COMP_ID, input: validInput });

    const update = calls.find((c) => c.op === 'update');
    expect(update?.args[0]).toEqual({
      code: validInput.code,
      nom: validInput.nom,
      sport: validInput.sport,
      status: validInput.status,
      date_debut: validInput.date_debut,
      date_fin: validInput.date_fin,
      logo_url: validInput.logo_url,
    });

    expect(
      calls.some(
        (c) => c.op === 'eq' && c.args[0] === 'id' && c.args[1] === COMP_ID,
      ),
    ).toBe(true);
  });

  it('propage une erreur Supabase', async () => {
    mockResponse = { data: null, error: { message: 'boom' } };
    await expect(
      updateCompetition({ id: COMP_ID, input: validInput }),
    ).rejects.toMatchObject({ message: 'boom' });
  });
});

// ------------------------------------------------------------------
//  deleteCompetition
// ------------------------------------------------------------------

describe('deleteCompetition', () => {
  it('delete sur competitions filtré par id', async () => {
    mockResponse = { data: null, error: null };
    await deleteCompetition(COMP_ID);

    expect(
      calls.some((c) => c.op === 'from' && c.args[0] === 'competitions'),
    ).toBe(true);
    expect(calls.some((c) => c.op === 'delete')).toBe(true);
    expect(
      calls.some(
        (c) => c.op === 'eq' && c.args[0] === 'id' && c.args[1] === COMP_ID,
      ),
    ).toBe(true);
  });

  it('propage une erreur FK RESTRICT 23503 (en usage)', async () => {
    mockResponse = {
      data: null,
      error: { code: '23503', message: 'violates foreign key constraint' },
    };
    await expect(deleteCompetition(COMP_ID)).rejects.toMatchObject({
      code: '23503',
    });
  });
});
