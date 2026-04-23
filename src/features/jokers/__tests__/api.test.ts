import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Builder Supabase minimal (pattern aligné sur badges/classement/pronos).
 *
 *   - `mockResponse` pilote data/error/count depuis chaque test.
 *   - `mockRpcResponse` pilote la réponse du RPC `use_joker`.
 *   - `calls` enregistre les ops pour asserter la chaîne (`from` →
 *     `select` → `eq` → `order` → `is` → `update` + `rpc`).
 */

type SupaResponse<T = unknown> = {
  data: T;
  error: { code?: string; message: string } | null;
  count?: number | null;
};

let mockResponse: SupaResponse = { data: null, error: null };
let mockRpcResponse: SupaResponse = { data: null, error: null };
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

  for (const op of ['select', 'eq', 'is', 'order', 'limit', 'in', 'update']) {
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
      rpc: vi.fn(async (name: string, args: unknown) => {
        record('rpc', name, args);
        return mockRpcResponse;
      }),
    },
  };
});

import {
  consumeJoker,
  countUserOwnedJokersInConcours,
  listConcoursParticipantsForPicker,
  listJokersCatalog,
  listUserJokersInConcours,
  setConcoursJokersEnabled,
} from '@/features/jokers/api';

const USER = '11111111-1111-1111-1111-111111111111';
const CONCOURS = '22222222-2222-2222-2222-222222222222';
const SLOT = '33333333-3333-3333-3333-333333333333';

const validCatalogRaw = {
  code: 'double',
  category: 'boost',
  libelle: { fr: 'Double', en: 'Double' },
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

beforeEach(() => {
  calls.length = 0;
  mockResponse = { data: null, error: null };
  mockRpcResponse = { data: null, error: null };
});

// ==================================================================
//  listJokersCatalog
// ==================================================================

describe('listJokersCatalog', () => {
  it('requête jokers triée par sort_order asc', async () => {
    mockResponse = { data: [], error: null };
    await listJokersCatalog();

    expect(calls.some((c) => c.op === 'from' && c.args[0] === 'jokers')).toBe(
      true,
    );
    const orders = calls.filter((c) => c.op === 'order');
    expect(orders[0]).toMatchObject({
      args: ['sort_order', { ascending: true }],
    });
  });

  it('normalise les lignes valides, ignore les cassées', async () => {
    mockResponse = {
      data: [
        validCatalogRaw,
        { ...validCatalogRaw, code: 'broken', libelle: { fr: 'x' } },
        { ...validCatalogRaw, code: null },
      ],
      error: null,
    };

    const rows = await listJokersCatalog();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.code).toBe('double');
  });

  it('retourne [] si data est null', async () => {
    mockResponse = { data: null, error: null };
    const rows = await listJokersCatalog();
    expect(rows).toEqual([]);
  });

  it('propage une erreur Supabase', async () => {
    mockResponse = { data: null, error: { message: 'network' } };
    await expect(listJokersCatalog()).rejects.toMatchObject({
      message: 'network',
    });
  });
});

// ==================================================================
//  listUserJokersInConcours
// ==================================================================

describe('listUserJokersInConcours', () => {
  it('filtre user_id + concours_id + order used_at asc then acquired_at desc + select nested joker', async () => {
    mockResponse = { data: [], error: null };
    await listUserJokersInConcours(USER, CONCOURS);

    expect(
      calls.some((c) => c.op === 'from' && c.args[0] === 'user_jokers'),
    ).toBe(true);

    const selects = calls.filter((c) => c.op === 'select');
    expect(selects[0]?.args[0]).toMatch(/joker:jokers/);

    const eqs = calls.filter((c) => c.op === 'eq');
    expect(eqs).toHaveLength(2);
    expect(eqs[0]).toMatchObject({ args: ['user_id', USER] });
    expect(eqs[1]).toMatchObject({ args: ['concours_id', CONCOURS] });

    const orders = calls.filter((c) => c.op === 'order');
    expect(orders[0]).toMatchObject({
      args: ['used_at', { ascending: true, nullsFirst: true }],
    });
    expect(orders[1]).toMatchObject({
      args: ['acquired_at', { ascending: false }],
    });
  });

  it('normalise les lignes jointes valides et filtre les cassées', async () => {
    mockResponse = {
      data: [
        { ...validUserJokerRaw, joker: validCatalogRaw },
        // Invalide : joker absent
        {
          ...validUserJokerRaw,
          id: '44444444-4444-4444-4444-444444444444',
          joker: null,
        },
      ],
      error: null,
    };

    const rows = await listUserJokersInConcours(USER, CONCOURS);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.joker.code).toBe('double');
  });

  it('propage une erreur RLS (42501)', async () => {
    mockResponse = { data: null, error: { code: '42501', message: 'rls' } };
    await expect(
      listUserJokersInConcours(USER, CONCOURS),
    ).rejects.toMatchObject({ code: '42501' });
  });
});

// ==================================================================
//  countUserOwnedJokersInConcours
// ==================================================================

describe('countUserOwnedJokersInConcours', () => {
  it('select count+head + eq user_id + eq concours_id + is used_at null', async () => {
    mockResponse = { data: null, error: null, count: 3 };
    const n = await countUserOwnedJokersInConcours(USER, CONCOURS);

    expect(n).toBe(3);
    expect(
      calls.some((c) => c.op === 'from' && c.args[0] === 'user_jokers'),
    ).toBe(true);

    const selects = calls.filter((c) => c.op === 'select');
    expect(selects[0]?.args[1]).toMatchObject({
      count: 'exact',
      head: true,
    });

    const eqs = calls.filter((c) => c.op === 'eq');
    expect(eqs[0]).toMatchObject({ args: ['user_id', USER] });
    expect(eqs[1]).toMatchObject({ args: ['concours_id', CONCOURS] });

    const iss = calls.filter((c) => c.op === 'is');
    expect(iss[0]).toMatchObject({ args: ['used_at', null] });
  });

  it('retourne 0 si count null', async () => {
    mockResponse = { data: null, error: null, count: null };
    const n = await countUserOwnedJokersInConcours(USER, CONCOURS);
    expect(n).toBe(0);
  });

  it('propage une erreur', async () => {
    mockResponse = { data: null, error: { message: 'boom' } };
    await expect(
      countUserOwnedJokersInConcours(USER, CONCOURS),
    ).rejects.toMatchObject({ message: 'boom' });
  });
});

// ==================================================================
//  setConcoursJokersEnabled
// ==================================================================

describe('setConcoursJokersEnabled', () => {
  it('update concours.jokers_enabled filtré sur id', async () => {
    mockResponse = { data: null, error: null };
    await setConcoursJokersEnabled(CONCOURS, true);

    expect(calls.some((c) => c.op === 'from' && c.args[0] === 'concours')).toBe(
      true,
    );

    const updates = calls.filter((c) => c.op === 'update');
    expect(updates[0]).toMatchObject({
      args: [{ jokers_enabled: true }],
    });

    const eqs = calls.filter((c) => c.op === 'eq');
    expect(eqs[0]).toMatchObject({ args: ['id', CONCOURS] });
  });

  it('envoie jokers_enabled:false sur désactivation', async () => {
    mockResponse = { data: null, error: null };
    await setConcoursJokersEnabled(CONCOURS, false);

    const updates = calls.filter((c) => c.op === 'update');
    expect(updates[0]?.args[0]).toEqual({ jokers_enabled: false });
  });

  it('propage une erreur RLS 42501 (non-owner)', async () => {
    mockResponse = { data: null, error: { code: '42501', message: 'rls' } };
    await expect(
      setConcoursJokersEnabled(CONCOURS, true),
    ).rejects.toMatchObject({ code: '42501' });
  });
});

// ==================================================================
//  consumeJoker (RPC use_joker)
// ==================================================================

describe('consumeJoker', () => {
  const MATCH = '44444444-4444-4444-4444-444444444444';
  const TARGET_USER = '55555555-5555-5555-5555-555555555555';

  const validUsedJokerRaw = {
    ...validUserJokerRaw,
    used_at: '2026-04-27T12:34:56Z',
    used_on_match_id: MATCH,
    used_on_target_user_id: null,
    used_payload: {},
  };

  it('appelle rpc("use_joker", ...) avec les 4 params (match only)', async () => {
    mockRpcResponse = { data: validUsedJokerRaw, error: null };
    await consumeJoker({ userJokerId: SLOT, targetMatchId: MATCH });

    const rpc = calls.find((c) => c.op === 'rpc');
    expect(rpc).toBeDefined();
    expect(rpc?.args[0]).toBe('use_joker');
    expect(rpc?.args[1]).toMatchObject({
      p_user_joker_id: SLOT,
      p_target_match_id: MATCH,
    });
  });

  it('passe p_target_user_id quand fourni (challenge / gift)', async () => {
    mockRpcResponse = {
      data: {
        ...validUsedJokerRaw,
        used_on_target_user_id: TARGET_USER,
      },
      error: null,
    };

    await consumeJoker({
      userJokerId: SLOT,
      targetMatchId: MATCH,
      targetUserId: TARGET_USER,
    });

    const rpc = calls.find((c) => c.op === 'rpc');
    expect(rpc?.args[1]).toMatchObject({
      p_user_joker_id: SLOT,
      p_target_match_id: MATCH,
      p_target_user_id: TARGET_USER,
    });
  });

  it('passe p_payload quand fourni (gift → gifted_joker_code)', async () => {
    mockRpcResponse = {
      data: {
        ...validUsedJokerRaw,
        used_on_match_id: null,
        used_on_target_user_id: TARGET_USER,
        used_payload: { gifted_joker_code: 'double' },
      },
      error: null,
    };

    await consumeJoker({
      userJokerId: SLOT,
      targetUserId: TARGET_USER,
      payload: { gifted_joker_code: 'double' },
    });

    const rpc = calls.find((c) => c.op === 'rpc');
    expect(rpc?.args[1]).toMatchObject({
      p_user_joker_id: SLOT,
      p_target_user_id: TARGET_USER,
      p_payload: { gifted_joker_code: 'double' },
    });
  });

  it('retourne la ligne normalisée (used_at renseigné)', async () => {
    mockRpcResponse = { data: validUsedJokerRaw, error: null };
    const row = await consumeJoker({
      userJokerId: SLOT,
      targetMatchId: MATCH,
    });

    expect(row.id).toBe(SLOT);
    expect(row.used_at).toBe('2026-04-27T12:34:56Z');
    expect(row.used_on_match_id).toBe(MATCH);
  });

  it('propage l erreur SQL (raise exception → .message contient le code)', async () => {
    mockRpcResponse = {
      data: null,
      error: { code: 'P0001', message: 'match_locked' },
    };

    await expect(
      consumeJoker({ userJokerId: SLOT, targetMatchId: MATCH }),
    ).rejects.toMatchObject({ message: 'match_locked' });
  });

  it('throw use_joker_invalid_response si normalize échoue', async () => {
    // Supabase a répondu OK mais la ligne est incohérente (pas d'id).
    mockRpcResponse = {
      data: { ...validUsedJokerRaw, id: null },
      error: null,
    };

    await expect(
      consumeJoker({ userJokerId: SLOT, targetMatchId: MATCH }),
    ).rejects.toThrow('use_joker_invalid_response');
  });
});

// ==================================================================
//  listConcoursParticipantsForPicker
// ==================================================================

describe('listConcoursParticipantsForPicker', () => {
  const USER_A = '66666666-6666-6666-6666-666666666666';
  const USER_B = '77777777-7777-7777-7777-777777777777';

  it('from("concours_participants") + select profil + eq concours_id + order joined_at desc', async () => {
    mockResponse = { data: [], error: null };
    await listConcoursParticipantsForPicker(CONCOURS);

    expect(
      calls.some(
        (c) => c.op === 'from' && c.args[0] === 'concours_participants',
      ),
    ).toBe(true);

    const selects = calls.filter((c) => c.op === 'select');
    expect(selects[0]?.args[0]).toMatch(/profile:profiles/);

    const eqs = calls.filter((c) => c.op === 'eq');
    expect(eqs[0]).toMatchObject({ args: ['concours_id', CONCOURS] });

    const orders = calls.filter((c) => c.op === 'order');
    expect(orders[0]).toMatchObject({
      args: ['joined_at', { ascending: false }],
    });
  });

  it('unwrap le profile objet et expose prenom / nom / avatar_url', async () => {
    mockResponse = {
      data: [
        {
          user_id: USER_A,
          role: 'owner',
          joined_at: '2026-04-20T10:00:00Z',
          profile: {
            id: USER_A,
            prenom: 'Alice',
            nom: 'Martin',
            avatar_url: 'https://x/a.png',
          },
        },
      ],
      error: null,
    };

    const rows = await listConcoursParticipantsForPicker(CONCOURS);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: USER_A,
      role: 'owner',
      prenom: 'Alice',
      nom: 'Martin',
      avatar_url: 'https://x/a.png',
    });
  });

  it('unwrap le profile retourné comme tableau (types générés défensifs)', async () => {
    mockResponse = {
      data: [
        {
          user_id: USER_B,
          role: null,
          joined_at: '2026-04-19T10:00:00Z',
          profile: [
            {
              id: USER_B,
              prenom: 'Bob',
              nom: null,
              avatar_url: null,
            },
          ],
        },
      ],
      error: null,
    };

    const rows = await listConcoursParticipantsForPicker(CONCOURS);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: USER_B,
      role: null,
      prenom: 'Bob',
      nom: null,
      avatar_url: null,
    });
  });

  it('filtre les lignes sans user_id', async () => {
    mockResponse = {
      data: [
        {
          user_id: null,
          role: 'member',
          joined_at: '2026-04-20T10:00:00Z',
          profile: { id: 'x', prenom: null, nom: null, avatar_url: null },
        },
        {
          user_id: USER_A,
          role: 'member',
          joined_at: '2026-04-20T10:00:00Z',
          profile: null,
        },
      ],
      error: null,
    };

    const rows = await listConcoursParticipantsForPicker(CONCOURS);
    // La 1re ligne est filtrée (user_id null). La 2e passe avec profil vide.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.user_id).toBe(USER_A);
    expect(rows[0]?.prenom).toBeNull();
  });

  it('retourne [] si data null', async () => {
    mockResponse = { data: null, error: null };
    const rows = await listConcoursParticipantsForPicker(CONCOURS);
    expect(rows).toEqual([]);
  });

  it('propage une erreur RLS 42501', async () => {
    mockResponse = { data: null, error: { code: '42501', message: 'rls' } };
    await expect(
      listConcoursParticipantsForPicker(CONCOURS),
    ).rejects.toMatchObject({ code: '42501' });
  });
});
