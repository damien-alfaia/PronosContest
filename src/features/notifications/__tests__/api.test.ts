import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Builder Supabase minimal pour la feature notifications.
 *
 * Chaque méthode chainable (`select`, `eq`, `is`, `order`, `limit`,
 * `lt`, `update`) retourne le builder après enregistrement de son appel
 * dans `calls`. `maybeSingle()` et `.then()` résolvent avec
 * `mockResponse` courant. `count` et `head` sont lus via le 2e arg du
 * `select`.
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

  for (const op of ['select', 'eq', 'is', 'order', 'limit', 'lt', 'update']) {
    builder[op] = chain(op);
  }

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
  },
}));

import {
  DEFAULT_PAGE_SIZE,
  countUnreadNotifications,
  getNotificationById,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/features/notifications/api';

const USER = '11111111-1111-1111-1111-111111111111';
const NOTIF_ID = '22222222-2222-2222-2222-222222222222';

const validRow = {
  id: NOTIF_ID,
  user_id: USER,
  type: 'badge_earned',
  title: null,
  body: null,
  payload: {
    badge_code: 'rookie',
    earned_at: '2026-04-20T12:00:00Z',
    metadata: {},
  },
  read_at: null,
  created_at: '2026-04-20T12:00:00Z',
};

beforeEach(() => {
  calls.length = 0;
  mockResponse = { data: null, error: null };
});

// ==================================================================
//  listNotifications
// ==================================================================

describe('listNotifications', () => {
  it('cible la table notifications et sélectionne les colonnes explicites', async () => {
    mockResponse = { data: [], error: null };
    await listNotifications(USER);

    const from = calls.find((c) => c.op === 'from');
    expect(from?.args[0]).toBe('notifications');

    const selects = calls.filter((c) => c.op === 'select');
    expect(selects[0]?.args[0]).toContain('id');
    expect(selects[0]?.args[0]).toContain('user_id');
    expect(selects[0]?.args[0]).toContain('type');
    expect(selects[0]?.args[0]).toContain('payload');
    // jamais de wildcard
    expect(selects[0]?.args[0]).not.toContain('*');
  });

  it('filtre par user_id + order DESC + limit DEFAULT_PAGE_SIZE', async () => {
    mockResponse = { data: [], error: null };
    await listNotifications(USER);

    const eqs = calls.filter((c) => c.op === 'eq');
    expect(eqs[0]).toMatchObject({ args: ['user_id', USER] });

    const orders = calls.filter((c) => c.op === 'order');
    expect(orders[0]).toMatchObject({
      args: ['created_at', { ascending: false }],
    });

    const limits = calls.filter((c) => c.op === 'limit');
    expect(limits[0]?.args[0]).toBe(DEFAULT_PAGE_SIZE);
  });

  it('before → .lt("created_at", before) pour la pagination', async () => {
    mockResponse = { data: [], error: null };
    await listNotifications(USER, { before: '2026-04-20T12:00:00Z', limit: 10 });

    const lts = calls.filter((c) => c.op === 'lt');
    expect(lts[0]).toMatchObject({
      args: ['created_at', '2026-04-20T12:00:00Z'],
    });

    const limits = calls.filter((c) => c.op === 'limit');
    expect(limits[0]?.args[0]).toBe(10);
  });

  it('pas de .lt() si before non fourni', async () => {
    mockResponse = { data: [], error: null };
    await listNotifications(USER);
    const lts = calls.filter((c) => c.op === 'lt');
    expect(lts).toHaveLength(0);
  });

  it('normalise les rows et retourne Notification[]', async () => {
    mockResponse = { data: [validRow], error: null };
    const out = await listNotifications(USER);
    expect(out).toHaveLength(1);
    expect(out[0]?.type).toBe('badge_earned');
  });

  it('filtre les rows invalides sans planter', async () => {
    mockResponse = {
      data: [
        validRow,
        { ...validRow, id: null }, // invalide
        { ...validRow, type: 'unknown_type' }, // type inconnu
      ],
      error: null,
    };
    const out = await listNotifications(USER);
    expect(out).toHaveLength(1);
  });

  it('retourne [] si data null', async () => {
    mockResponse = { data: null, error: null };
    const out = await listNotifications(USER);
    expect(out).toEqual([]);
  });

  it('propage une erreur RLS (42501)', async () => {
    mockResponse = { data: null, error: { code: '42501', message: 'rls' } };
    await expect(listNotifications(USER)).rejects.toMatchObject({
      code: '42501',
    });
  });
});

// ==================================================================
//  countUnreadNotifications
// ==================================================================

describe('countUnreadNotifications', () => {
  it('sélectionne avec { count: exact, head: true } + .is("read_at", null)', async () => {
    mockResponse = { data: null, error: null, count: 7 };
    const out = await countUnreadNotifications(USER);

    const selects = calls.filter((c) => c.op === 'select');
    expect(selects[0]?.args[1]).toMatchObject({
      count: 'exact',
      head: true,
    });

    const eqs = calls.filter((c) => c.op === 'eq');
    expect(eqs[0]).toMatchObject({ args: ['user_id', USER] });

    const iss = calls.filter((c) => c.op === 'is');
    expect(iss[0]).toMatchObject({ args: ['read_at', null] });

    expect(out).toBe(7);
  });

  it('retourne 0 si count null', async () => {
    mockResponse = { data: null, error: null, count: null };
    const out = await countUnreadNotifications(USER);
    expect(out).toBe(0);
  });

  it('propage erreur', async () => {
    mockResponse = { data: null, error: { message: 'boom' }, count: null };
    await expect(countUnreadNotifications(USER)).rejects.toMatchObject({
      message: 'boom',
    });
  });
});

// ==================================================================
//  markNotificationAsRead
// ==================================================================

describe('markNotificationAsRead', () => {
  it('update avec read_at ISO + .eq("id") + .is("read_at", null) (idempotent)', async () => {
    mockResponse = { data: null, error: null };
    await markNotificationAsRead(NOTIF_ID);

    const from = calls.find((c) => c.op === 'from');
    expect(from?.args[0]).toBe('notifications');

    const update = calls.find((c) => c.op === 'update');
    expect(update?.args[0]).toMatchObject({
      read_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), // ISO
    });

    const eqs = calls.filter((c) => c.op === 'eq');
    expect(eqs[0]).toMatchObject({ args: ['id', NOTIF_ID] });

    const iss = calls.filter((c) => c.op === 'is');
    expect(iss[0]).toMatchObject({ args: ['read_at', null] });
  });

  it('propage erreur', async () => {
    mockResponse = {
      data: null,
      error: { code: '42501', message: 'rls' },
    };
    await expect(markNotificationAsRead(NOTIF_ID)).rejects.toMatchObject({
      code: '42501',
    });
  });
});

// ==================================================================
//  markAllNotificationsAsRead
// ==================================================================

describe('markAllNotificationsAsRead', () => {
  it('update batch avec user_id + filter read_at null', async () => {
    mockResponse = { data: null, error: null };
    await markAllNotificationsAsRead(USER);

    const update = calls.find((c) => c.op === 'update');
    expect(update?.args[0]).toMatchObject({
      read_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });

    const eqs = calls.filter((c) => c.op === 'eq');
    expect(eqs[0]).toMatchObject({ args: ['user_id', USER] });

    const iss = calls.filter((c) => c.op === 'is');
    expect(iss[0]).toMatchObject({ args: ['read_at', null] });
  });

  it('propage erreur', async () => {
    mockResponse = { data: null, error: { message: 'boom' } };
    await expect(markAllNotificationsAsRead(USER)).rejects.toMatchObject({
      message: 'boom',
    });
  });
});

// ==================================================================
//  getNotificationById
// ==================================================================

describe('getNotificationById', () => {
  it('filtre par id + maybeSingle + normalise', async () => {
    mockResponse = { data: validRow, error: null };
    const out = await getNotificationById(NOTIF_ID);

    const eqs = calls.filter((c) => c.op === 'eq');
    expect(eqs[0]).toMatchObject({ args: ['id', NOTIF_ID] });

    expect(calls.some((c) => c.op === 'maybeSingle')).toBe(true);
    expect(out?.id).toBe(NOTIF_ID);
  });

  it('retourne null si data null', async () => {
    mockResponse = { data: null, error: null };
    const out = await getNotificationById(NOTIF_ID);
    expect(out).toBeNull();
  });

  it('retourne null si row invalide (type inconnu)', async () => {
    mockResponse = {
      data: { ...validRow, type: 'unknown_type' },
      error: null,
    };
    const out = await getNotificationById(NOTIF_ID);
    expect(out).toBeNull();
  });

  it('propage erreur', async () => {
    mockResponse = { data: null, error: { message: 'boom' } };
    await expect(getNotificationById(NOTIF_ID)).rejects.toMatchObject({
      message: 'boom',
    });
  });
});
