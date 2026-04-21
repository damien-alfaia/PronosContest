import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Builder Supabase minimal pour la feature chat.
 *
 * Chaque méthode chainable (`select`, `eq`, `order`, `limit`, `lt`,
 * `insert`) retourne le builder lui-même après avoir enregistré son
 * appel dans `calls`. `single()`, `maybeSingle()` et `.then()`
 * résolvent avec la réponse courante (`mockResponse`).
 *
 * `auth.getUser()` est pilotable via `mockUser` / `mockAuthError`.
 */

type SupaResponse<T = unknown> = {
  data: T;
  error: { code?: string; message: string } | null;
};

let mockResponse: SupaResponse = { data: null, error: null };
let mockUser: { id: string } | null = null;
let mockAuthError: { message: string } | null = null;
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

  for (const op of ['select', 'eq', 'order', 'limit', 'lt', 'insert']) {
    builder[op] = chain(op);
  }

  builder.single = vi.fn(async () => {
    record('single');
    return mockResponse;
  });
  builder.maybeSingle = vi.fn(async () => {
    record('maybeSingle');
    return mockResponse;
  });
  (builder as { then: (fn: (r: SupaResponse) => void) => void }).then = (fn) =>
    Promise.resolve(mockResponse).then(fn);

  return builder;
};

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      record('from', table);
      return makeBuilder();
    }),
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: mockUser },
        error: mockAuthError,
      })),
    },
  },
}));

import {
  DEFAULT_PAGE_SIZE,
  getMessageById,
  listMessages,
  sendMessage,
} from '@/features/chat/api';

const CONCOURS = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const USER = '11111111-1111-1111-1111-111111111111';
const AUTHOR_ID = '22222222-2222-2222-2222-222222222222';
const MSG_ID = '33333333-3333-3333-3333-333333333333';

const validMsgRow = {
  id: MSG_ID,
  concours_id: CONCOURS,
  user_id: AUTHOR_ID,
  body: 'hello',
  created_at: '2026-04-20T12:00:00Z',
  author: {
    id: AUTHOR_ID,
    prenom: 'Alice',
    nom: 'Martin',
    avatar_url: null,
  },
};

beforeEach(() => {
  calls.length = 0;
  mockResponse = { data: null, error: null };
  mockUser = null;
  mockAuthError = null;
});

// ==================================================================
//  listMessages
// ==================================================================

describe('listMessages', () => {
  it('cible la table concours_messages + select avec join author', async () => {
    mockResponse = { data: [], error: null };
    await listMessages(CONCOURS);

    const from = calls.find((c) => c.op === 'from');
    expect(from?.args[0]).toBe('concours_messages');

    const selects = calls.filter((c) => c.op === 'select');
    expect(selects[0]?.args[0]).toMatch(/author:profiles/);
  });

  it('filtre par concours_id + order DESC + limit DEFAULT_PAGE_SIZE', async () => {
    mockResponse = { data: [], error: null };
    await listMessages(CONCOURS);

    const eqs = calls.filter((c) => c.op === 'eq');
    expect(eqs[0]).toMatchObject({ args: ['concours_id', CONCOURS] });

    const orders = calls.filter((c) => c.op === 'order');
    expect(orders[0]).toMatchObject({
      args: ['created_at', { ascending: false }],
    });

    const limits = calls.filter((c) => c.op === 'limit');
    expect(limits[0]?.args[0]).toBe(DEFAULT_PAGE_SIZE);
  });

  it('limit personnalisée et before → .lt("created_at", before)', async () => {
    mockResponse = { data: [], error: null };
    await listMessages(CONCOURS, {
      limit: 20,
      before: '2026-04-20T12:00:00Z',
    });

    const limits = calls.filter((c) => c.op === 'limit');
    expect(limits[0]?.args[0]).toBe(20);

    const lts = calls.filter((c) => c.op === 'lt');
    expect(lts[0]).toMatchObject({
      args: ['created_at', '2026-04-20T12:00:00Z'],
    });
  });

  it('pas de .lt() si before non fourni', async () => {
    mockResponse = { data: [], error: null };
    await listMessages(CONCOURS);
    const lts = calls.filter((c) => c.op === 'lt');
    expect(lts).toHaveLength(0);
  });

  it('retourne les messages en ASC (reverse de DESC)', async () => {
    const a = { ...validMsgRow, id: 'a0000000-0000-0000-0000-000000000000', created_at: '2026-04-20T10:00:00Z' };
    const b = { ...validMsgRow, id: 'b0000000-0000-0000-0000-000000000000', created_at: '2026-04-20T11:00:00Z' };
    const c = { ...validMsgRow, id: 'c0000000-0000-0000-0000-000000000000', created_at: '2026-04-20T12:00:00Z' };
    // SQL envoie DESC : [c, b, a]. On attend ASC : [a, b, c].
    mockResponse = { data: [c, b, a], error: null };

    const out = await listMessages(CONCOURS);
    expect(out.map((m) => m.id)).toEqual([
      'a0000000-0000-0000-0000-000000000000',
      'b0000000-0000-0000-0000-000000000000',
      'c0000000-0000-0000-0000-000000000000',
    ]);
  });

  it('extrait author du premier élément si Supabase renvoie un tableau', async () => {
    mockResponse = {
      data: [
        {
          ...validMsgRow,
          author: [validMsgRow.author], // format tableau possible
        },
      ],
      error: null,
    };
    const out = await listMessages(CONCOURS);
    expect(out[0]?.author?.prenom).toBe('Alice');
  });

  it('filtre les lignes invalides (id null)', async () => {
    mockResponse = {
      data: [
        validMsgRow,
        { ...validMsgRow, id: null },
      ],
      error: null,
    };
    const out = await listMessages(CONCOURS);
    expect(out).toHaveLength(1);
  });

  it('retourne [] si data null', async () => {
    mockResponse = { data: null, error: null };
    const out = await listMessages(CONCOURS);
    expect(out).toEqual([]);
  });

  it('propage une erreur RLS (42501)', async () => {
    mockResponse = { data: null, error: { code: '42501', message: 'rls' } };
    await expect(listMessages(CONCOURS)).rejects.toMatchObject({
      code: '42501',
    });
  });
});

// ==================================================================
//  sendMessage
// ==================================================================

describe('sendMessage', () => {
  it('rejette si pas de session', async () => {
    mockUser = null;
    await expect(sendMessage(CONCOURS, 'hi')).rejects.toThrow(
      'chat.errors.notAuthenticated',
    );
  });

  it('propage une erreur auth', async () => {
    mockAuthError = { message: 'auth failed' };
    await expect(sendMessage(CONCOURS, 'hi')).rejects.toMatchObject({
      message: 'auth failed',
    });
  });

  it('insère {concours_id, user_id, body} + select join + single', async () => {
    mockUser = { id: USER };
    mockResponse = { data: validMsgRow, error: null };

    const out = await sendMessage(CONCOURS, 'hello');

    const from = calls.find((c) => c.op === 'from');
    expect(from?.args[0]).toBe('concours_messages');

    const insert = calls.find((c) => c.op === 'insert');
    expect(insert?.args[0]).toMatchObject({
      concours_id: CONCOURS,
      user_id: USER,
      body: 'hello',
    });

    const selects = calls.filter((c) => c.op === 'select');
    expect(selects[0]?.args[0]).toMatch(/author:profiles/);

    expect(calls.some((c) => c.op === 'single')).toBe(true);
    expect(out.id).toBe(MSG_ID);
  });

  it('rejette si le row inséré est invalide (colonnes null)', async () => {
    mockUser = { id: USER };
    mockResponse = {
      data: { ...validMsgRow, id: null },
      error: null,
    };

    await expect(sendMessage(CONCOURS, 'hi')).rejects.toThrow(
      'chat.errors.insertFailed',
    );
  });

  it('propage une erreur CHECK (23514)', async () => {
    mockUser = { id: USER };
    mockResponse = {
      data: null,
      error: { code: '23514', message: 'check violation' },
    };
    await expect(sendMessage(CONCOURS, '')).rejects.toMatchObject({
      code: '23514',
    });
  });

  it('propage une erreur RLS (42501)', async () => {
    mockUser = { id: USER };
    mockResponse = {
      data: null,
      error: { code: '42501', message: 'rls' },
    };
    await expect(sendMessage(CONCOURS, 'hi')).rejects.toMatchObject({
      code: '42501',
    });
  });
});

// ==================================================================
//  getMessageById
// ==================================================================

describe('getMessageById', () => {
  it('filtre par id + maybeSingle + select join', async () => {
    mockResponse = { data: validMsgRow, error: null };
    const out = await getMessageById(MSG_ID);

    const eqs = calls.filter((c) => c.op === 'eq');
    expect(eqs[0]).toMatchObject({ args: ['id', MSG_ID] });

    expect(calls.some((c) => c.op === 'maybeSingle')).toBe(true);
    expect(out?.id).toBe(MSG_ID);
  });

  it('retourne null si data null (message supprimé / RLS cache)', async () => {
    mockResponse = { data: null, error: null };
    const out = await getMessageById(MSG_ID);
    expect(out).toBeNull();
  });

  it('propage une erreur', async () => {
    mockResponse = { data: null, error: { message: 'boom' } };
    await expect(getMessageById(MSG_ID)).rejects.toMatchObject({
      message: 'boom',
    });
  });
});
