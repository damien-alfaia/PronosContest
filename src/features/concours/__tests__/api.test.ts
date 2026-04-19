import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mock du client Supabase en builder chainable.
 *
 * - Chaque méthode de chaînage retourne le même objet "builder".
 * - Les terminaisons (`single`, `maybeSingle`, await direct) utilisent
 *   la réponse préparée par le test (`mockResponse`).
 * - `rpc(name, args)` utilise aussi `mockResponse` et capture les
 *   arguments dans `rpcCalls` pour assertion.
 */

type SupaResponse<T = unknown> = { data: T; error: { code?: string; message: string } | null };

let mockResponse: SupaResponse = { data: null, error: null };
const calls: Array<{ op: string; args: unknown[] }> = [];
const rpcCalls: Array<{ name: string; args: unknown }> = [];

const record = (op: string, ...args: unknown[]) => calls.push({ op, args });

const makeBuilder = () => {
  const builder: Record<string, unknown> = {};
  const chain = (op: string) =>
    (...args: unknown[]) => {
      record(op, ...args);
      return builder;
    };

  // chaînables
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

  // terminaisons
  builder.single = vi.fn(async () => mockResponse);
  builder.maybeSingle = vi.fn(async () => mockResponse);
  // Supabase autorise `await query` : on émule via then.
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
      rpc: vi.fn(async (name: string, args: unknown) => {
        rpcCalls.push({ name, args });
        return mockResponse;
      }),
    },
  };
});

import {
  createConcours,
  getConcoursById,
  joinConcoursByCode,
  joinPublicConcours,
  listMyConcours,
  listPublicConcours,
} from '@/features/concours/api';
import type { ConcoursCreateInput } from '@/features/concours/schemas';
import { DEFAULT_SCORING_RULES } from '@/features/concours/schemas';

const UUID = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';

const sampleConcoursRow = {
  id: UUID,
  nom: 'Test',
  description: null,
  owner_id: USER,
  competition_id: UUID,
  visibility: 'public',
  code_invitation: null,
  scoring_rules: DEFAULT_SCORING_RULES,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  competition: {
    id: UUID,
    code: 'fifa-wc-2026',
    nom: 'Coupe du Monde 2026',
    sport: 'football',
    date_debut: '2026-06-11',
    date_fin: '2026-07-19',
    status: 'upcoming',
    logo_url: null,
  },
};

beforeEach(() => {
  calls.length = 0;
  rpcCalls.length = 0;
  mockResponse = { data: null, error: null };
});

describe('listMyConcours', () => {
  it('applatit { concours } -> concours[] et filtre les nulls', async () => {
    mockResponse = {
      data: [
        { joined_at: '2026-01-01', role: 'admin', concours: sampleConcoursRow },
        { joined_at: '2026-01-02', role: 'member', concours: null },
      ],
      error: null,
    };

    const result = await listMyConcours(USER);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(UUID);
    // vérifie qu'on a bien requêté la bonne table et filtré par user_id
    expect(calls.some((c) => c.op === 'from' && c.args[0] === 'concours_participants')).toBe(
      true,
    );
    expect(calls.some((c) => c.op === 'eq' && c.args[0] === 'user_id')).toBe(true);
  });

  it('remonte l’erreur Supabase', async () => {
    mockResponse = { data: null, error: { message: 'boom' } };
    await expect(listMyConcours(USER)).rejects.toMatchObject({ message: 'boom' });
  });
});

describe('listPublicConcours', () => {
  it('ne pose pas de ilike si pas de recherche', async () => {
    mockResponse = { data: [], error: null };
    await listPublicConcours();
    expect(calls.some((c) => c.op === 'ilike')).toBe(false);
    expect(calls.some((c) => c.op === 'eq' && c.args[0] === 'visibility')).toBe(true);
  });

  it('échappe les wildcards SQL `%` et `_` dans la recherche', async () => {
    mockResponse = { data: [], error: null };
    await listPublicConcours('50% off_');
    const ilike = calls.find((c) => c.op === 'ilike');
    expect(ilike).toBeDefined();
    expect(ilike?.args[1]).toBe(String.raw`%50\% off\_%`);
  });

  it('n’applique pas ilike si search ne contient que des espaces', async () => {
    mockResponse = { data: [], error: null };
    await listPublicConcours('   ');
    expect(calls.some((c) => c.op === 'ilike')).toBe(false);
  });
});

describe('getConcoursById', () => {
  it('utilise maybeSingle et retourne null si rien', async () => {
    mockResponse = { data: null, error: null };
    const result = await getConcoursById(UUID);
    expect(result).toBeNull();
  });
});

describe('createConcours', () => {
  it('envoie un payload avec owner_id et description=null si absente', async () => {
    mockResponse = { data: sampleConcoursRow, error: null };

    const input: ConcoursCreateInput = {
      nom: 'Mon concours',
      competition_id: UUID,
      visibility: 'public',
      scoring_rules: DEFAULT_SCORING_RULES,
    };

    await createConcours(USER, input);

    const insert = calls.find((c) => c.op === 'insert');
    expect(insert).toBeDefined();
    const payload = insert?.args[0] as Record<string, unknown>;
    expect(payload.owner_id).toBe(USER);
    expect(payload.nom).toBe('Mon concours');
    expect(payload.description).toBeNull();
    expect(payload.visibility).toBe('public');
  });
});

describe('joinPublicConcours', () => {
  it('ignore silencieusement l’erreur 23505 (unique violation)', async () => {
    mockResponse = {
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    };
    await expect(joinPublicConcours(UUID, USER)).resolves.toBeUndefined();
  });

  it('propage les autres erreurs', async () => {
    mockResponse = {
      data: null,
      error: { code: '42501', message: 'rls violation' },
    };
    await expect(joinPublicConcours(UUID, USER)).rejects.toMatchObject({
      message: 'rls violation',
    });
  });
});

describe('joinConcoursByCode', () => {
  it('appelle la RPC avec p_code', async () => {
    mockResponse = { data: UUID, error: null };
    const id = await joinConcoursByCode('ABCD1234');
    expect(id).toBe(UUID);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]?.name).toBe('join_concours_by_code');
    expect(rpcCalls[0]?.args).toEqual({ p_code: 'ABCD1234' });
  });

  it('remonte une erreur RPC', async () => {
    mockResponse = {
      data: null,
      error: { code: 'P0001', message: 'concours_not_found' },
    };
    await expect(joinConcoursByCode('WRONG')).rejects.toMatchObject({
      message: 'concours_not_found',
    });
  });
});
