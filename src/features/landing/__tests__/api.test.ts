import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests de la couche API landing (getLandingStats).
 *
 * On mock `supabase.rpc('get_landing_stats')` pour simuler les
 * différents scénarios : retour nominal, data null, data mal formée,
 * erreur RPC. Le schéma Zod doit filtrer les lignes invalides et
 * renvoyer LANDING_STATS_ZERO en fallback plutôt que throw.
 */

type RpcResponse = {
  data: unknown;
  error: { code?: string; message: string } | null;
};

let rpcResponse: RpcResponse = { data: null, error: null };
const rpcCalls: Array<{ fn: string; args: unknown }> = [];

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(async (fn: string, args?: unknown) => {
      rpcCalls.push({ fn, args });
      return rpcResponse;
    }),
  },
}));

import { getLandingStats, LANDING_STATS_ZERO } from '@/features/landing/api';

beforeEach(() => {
  rpcCalls.length = 0;
  rpcResponse = { data: null, error: null };
});

describe('getLandingStats', () => {
  it('appelle supabase.rpc avec "get_landing_stats"', async () => {
    rpcResponse = {
      data: { nb_concours: 1, nb_pronos: 2, nb_users: 3 },
      error: null,
    };

    await getLandingStats();

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]?.fn).toBe('get_landing_stats');
  });

  it('retourne les stats normalisées en camelCase sur payload valide', async () => {
    rpcResponse = {
      data: { nb_concours: 42, nb_pronos: 1337, nb_users: 128 },
      error: null,
    };

    const stats = await getLandingStats();

    expect(stats).toEqual({ nbConcours: 42, nbPronos: 1337, nbUsers: 128 });
  });

  it('retourne LANDING_STATS_ZERO si data=null', async () => {
    rpcResponse = { data: null, error: null };

    const stats = await getLandingStats();

    expect(stats).toEqual(LANDING_STATS_ZERO);
  });

  it('retourne LANDING_STATS_ZERO si champ manquant', async () => {
    rpcResponse = {
      data: { nb_concours: 1, nb_pronos: 2 /* nb_users manquant */ },
      error: null,
    };

    const stats = await getLandingStats();

    expect(stats).toEqual(LANDING_STATS_ZERO);
  });

  it('retourne LANDING_STATS_ZERO si nombre négatif (contrat Zod)', async () => {
    rpcResponse = {
      data: { nb_concours: -1, nb_pronos: 0, nb_users: 0 },
      error: null,
    };

    const stats = await getLandingStats();

    expect(stats).toEqual(LANDING_STATS_ZERO);
  });

  it("propage l'erreur RPC (throw)", async () => {
    rpcResponse = {
      data: null,
      error: { code: '42501', message: 'permission denied' },
    };

    await expect(getLandingStats()).rejects.toMatchObject({
      code: '42501',
    });
  });
});
