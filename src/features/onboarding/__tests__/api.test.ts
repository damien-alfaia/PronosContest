import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests de la couche API onboarding.
 *
 * Builder Supabase minimal avec support `.from().select().eq().maybeSingle()`
 * et `.from().update().eq().is()` (les 2 patterns utilisés par l'API).
 * On pilote `mockResponse` par test.
 */

type SupaResponse = {
  data: unknown;
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
  for (const op of ['select', 'eq', 'is', 'update']) {
    builder[op] = chain(op);
  }
  builder.maybeSingle = vi.fn(async () => mockResponse);
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
  dismissChecklist,
  getMyOnboardingProgress,
  markFirstConcoursJoined,
  markTourStepCompleted,
  markWelcomed,
  skipTour,
} from '@/features/onboarding/api';

const USER = '11111111-1111-1111-1111-111111111111';

const baseRow = {
  user_id: USER,
  welcomed_at: null,
  first_concours_joined_at: null,
  first_prono_saved_at: null,
  first_classement_viewed_at: null,
  first_invite_sent_at: null,
  tour_steps_completed: [],
  checklist_dismissed_at: null,
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
};

beforeEach(() => {
  calls.length = 0;
  mockResponse = { data: null, error: null };
});

describe('getMyOnboardingProgress', () => {
  it('requête user_onboarding_progress eq user_id + maybeSingle', async () => {
    mockResponse = { data: baseRow, error: null };
    await getMyOnboardingProgress(USER);
    expect(calls[0]).toEqual({ op: 'from', args: ['user_onboarding_progress'] });
    expect(calls.find((c) => c.op === 'eq')).toEqual({
      op: 'eq',
      args: ['user_id', USER],
    });
  });

  it('retourne la ligne normalisée si valide', async () => {
    mockResponse = { data: baseRow, error: null };
    const row = await getMyOnboardingProgress(USER);
    expect(row).not.toBeNull();
    expect(row?.user_id).toBe(USER);
  });

  it('retourne null si ligne absente', async () => {
    mockResponse = { data: null, error: null };
    const row = await getMyOnboardingProgress(USER);
    expect(row).toBeNull();
  });

  it('throw si erreur', async () => {
    mockResponse = { data: null, error: { message: 'perm denied' } };
    await expect(getMyOnboardingProgress(USER)).rejects.toMatchObject({
      message: 'perm denied',
    });
  });
});

describe('markWelcomed + markFirstConcoursJoined', () => {
  it('markWelcomed envoie un UPDATE sur welcomed_at avec filter is null', async () => {
    mockResponse = { data: null, error: null };
    await markWelcomed(USER);
    // Vérifie que l'update a été appelé + eq + is(welcomed_at, null)
    expect(calls.some((c) => c.op === 'update')).toBe(true);
    expect(calls.some((c) => c.op === 'is' && c.args[0] === 'welcomed_at')).toBe(
      true,
    );
    expect(calls.some((c) => c.op === 'eq' && c.args[0] === 'user_id')).toBe(
      true,
    );
  });

  it('markFirstConcoursJoined cible first_concours_joined_at', async () => {
    mockResponse = { data: null, error: null };
    await markFirstConcoursJoined(USER);
    expect(
      calls.some(
        (c) => c.op === 'is' && c.args[0] === 'first_concours_joined_at',
      ),
    ).toBe(true);
  });

  it('propage l\'erreur Supabase', async () => {
    mockResponse = { data: null, error: { message: 'locked' } };
    await expect(markWelcomed(USER)).rejects.toMatchObject({
      message: 'locked',
    });
  });
});

describe('markTourStepCompleted', () => {
  it('idempotent — ne update pas si le step est déjà présent', async () => {
    // 1er call (getMyOnboardingProgress) renvoie la row avec le step déjà là
    mockResponse = {
      data: { ...baseRow, tour_steps_completed: ['pronos.filters'] },
      error: null,
    };
    calls.length = 0;
    await markTourStepCompleted(USER, 'pronos.filters');
    // Aucun update ne doit avoir été appelé
    expect(calls.some((c) => c.op === 'update')).toBe(false);
  });

  it('append le step si absent', async () => {
    mockResponse = { data: baseRow, error: null };
    await markTourStepCompleted(USER, 'pronos.first_match_card');
    // update appelé avec { tour_steps_completed: [...] }
    const update = calls.find((c) => c.op === 'update');
    expect(update).toBeDefined();
    expect((update?.args[0] as { tour_steps_completed: string[] })
      .tour_steps_completed).toEqual(['pronos.first_match_card']);
  });
});

describe('skipTour + dismissChecklist', () => {
  it('skipTour update tour_steps_completed avec tous les IDs passés', async () => {
    mockResponse = { data: null, error: null };
    await skipTour(USER, ['pronos.filters', 'pronos.classement_cta']);
    const update = calls.find((c) => c.op === 'update');
    expect(
      (update?.args[0] as { tour_steps_completed: string[] })
        .tour_steps_completed,
    ).toEqual(['pronos.filters', 'pronos.classement_cta']);
  });

  it('dismissChecklist update checklist_dismissed_at avec un timestamp', async () => {
    mockResponse = { data: null, error: null };
    await dismissChecklist(USER);
    const update = calls.find((c) => c.op === 'update');
    const patch = update?.args[0] as { checklist_dismissed_at: string };
    expect(patch.checklist_dismissed_at).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
