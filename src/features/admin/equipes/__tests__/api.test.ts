import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests admin/equipes/api.ts
 *
 * Builder Supabase mocké (même pattern que admin/matchs/__tests__/api.test.ts).
 *
 * Invariants par fonction :
 *   - table ciblée (`equipes`),
 *   - payload `insert` / `update` (colonnes exactes),
 *   - `competition_id` NON inclus dans le payload d'update (trigger SQL
 *     `equipes_prevent_competition_change` verrouille le changement),
 *   - filtres `.eq('id', ...)` / `.eq('competition_id', ...)`,
 *   - tri `groupe` puis `nom`,
 *   - propagation des erreurs.
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
  createEquipe,
  deleteEquipe,
  listEquipesAdmin,
  updateEquipe,
} from '@/features/admin/equipes/api';
import type { EquipeUpsertInput } from '@/features/admin/equipes/schemas';

const COMP_ID = '22222222-0000-0000-0000-000000000001';
const EQ_ID = '33333333-0000-0000-0000-000000000001';

const validInput: EquipeUpsertInput = {
  competition_id: COMP_ID,
  code: 'FRA',
  nom: 'France',
  groupe: 'A',
  drapeau_url: 'https://example.com/fr.svg',
  fifa_id: 103,
};

beforeEach(() => {
  calls.length = 0;
  mockResponse = { data: null, error: null };
});

// ------------------------------------------------------------------
//  listEquipesAdmin
// ------------------------------------------------------------------

describe('listEquipesAdmin', () => {
  it('tape equipes + filtre competition_id + order groupe puis nom', async () => {
    mockResponse = { data: [], error: null };
    await listEquipesAdmin(COMP_ID);

    expect(
      calls.some((c) => c.op === 'from' && c.args[0] === 'equipes'),
    ).toBe(true);
    expect(
      calls.some(
        (c) =>
          c.op === 'eq' &&
          c.args[0] === 'competition_id' &&
          c.args[1] === COMP_ID,
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
    const rows = await listEquipesAdmin(COMP_ID);
    expect(rows).toEqual([]);
  });

  it('propage une erreur RLS', async () => {
    mockResponse = { data: null, error: { code: '42501', message: 'rls' } };
    await expect(listEquipesAdmin(COMP_ID)).rejects.toMatchObject({
      code: '42501',
    });
  });
});

// ------------------------------------------------------------------
//  createEquipe
// ------------------------------------------------------------------

describe('createEquipe', () => {
  it('insert payload complet (avec competition_id) sur equipes', async () => {
    mockResponse = { data: { id: EQ_ID }, error: null };
    await createEquipe(validInput);

    expect(
      calls.some((c) => c.op === 'from' && c.args[0] === 'equipes'),
    ).toBe(true);

    const insert = calls.find((c) => c.op === 'insert');
    expect(insert?.args[0]).toEqual({
      competition_id: validInput.competition_id,
      code: validInput.code,
      nom: validInput.nom,
      groupe: validInput.groupe,
      drapeau_url: validInput.drapeau_url,
      fifa_id: validInput.fifa_id,
    });
  });

  it('propage une erreur UNIQUE code/competition 23505', async () => {
    mockResponse = {
      data: null,
      error: {
        code: '23505',
        message: 'equipes_code_per_competition',
      },
    };
    await expect(createEquipe(validInput)).rejects.toMatchObject({
      code: '23505',
    });
  });
});

// ------------------------------------------------------------------
//  updateEquipe
// ------------------------------------------------------------------

describe('updateEquipe', () => {
  it('update n’envoie PAS competition_id (verrouillé côté client)', async () => {
    mockResponse = { data: { id: EQ_ID }, error: null };
    await updateEquipe({ id: EQ_ID, input: validInput });

    const update = calls.find((c) => c.op === 'update');
    expect(update?.args[0]).toEqual({
      code: validInput.code,
      nom: validInput.nom,
      groupe: validInput.groupe,
      drapeau_url: validInput.drapeau_url,
      fifa_id: validInput.fifa_id,
    });

    expect(update?.args[0]).not.toHaveProperty('competition_id');

    expect(
      calls.some(
        (c) => c.op === 'eq' && c.args[0] === 'id' && c.args[1] === EQ_ID,
      ),
    ).toBe(true);
  });

  it('propage une erreur Supabase', async () => {
    mockResponse = { data: null, error: { message: 'boom' } };
    await expect(
      updateEquipe({ id: EQ_ID, input: validInput }),
    ).rejects.toMatchObject({ message: 'boom' });
  });
});

// ------------------------------------------------------------------
//  deleteEquipe
// ------------------------------------------------------------------

describe('deleteEquipe', () => {
  it('delete sur equipes filtré par id', async () => {
    mockResponse = { data: null, error: null };
    await deleteEquipe(EQ_ID);

    expect(
      calls.some((c) => c.op === 'from' && c.args[0] === 'equipes'),
    ).toBe(true);
    expect(calls.some((c) => c.op === 'delete')).toBe(true);
    expect(
      calls.some(
        (c) => c.op === 'eq' && c.args[0] === 'id' && c.args[1] === EQ_ID,
      ),
    ).toBe(true);
  });

  it('propage une erreur FK RESTRICT 23503 (référencée par un match)', async () => {
    mockResponse = {
      data: null,
      error: { code: '23503', message: 'violates foreign key constraint' },
    };
    await expect(deleteEquipe(EQ_ID)).rejects.toMatchObject({
      code: '23503',
    });
  });
});
