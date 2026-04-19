import { describe, expect, it } from 'vitest';
import type { SafeParseReturnType } from 'zod';

import {
  deletePronoSchema,
  isKoPhase,
  KO_PHASES,
  PHASE_VALUES,
  pronoFormSchema,
  upsertPronoSchema,
} from '@/features/pronos/schemas';

const firstMessage = <I, O>(result: SafeParseReturnType<I, O>, path: string) => {
  if (result.success) return null;
  const issue = result.error.issues.find((i) => i.path.join('.') === path);
  return issue?.message ?? null;
};

const UUID_A = '11111111-1111-1111-1111-111111111111';
const UUID_B = '22222222-2222-2222-2222-222222222222';

// ------------------------------------------------------------------
//  Helpers phase
// ------------------------------------------------------------------

describe('isKoPhase / KO_PHASES', () => {
  it('détecte correctement la phase de groupes', () => {
    expect(isKoPhase('groupes')).toBe(false);
  });

  it('détecte toutes les phases à élimination directe', () => {
    for (const phase of PHASE_VALUES) {
      const expected = phase !== 'groupes';
      expect(isKoPhase(phase), `phase=${phase}`).toBe(expected);
    }
  });

  it('KO_PHASES exclut "groupes"', () => {
    expect(KO_PHASES.includes('groupes' as never)).toBe(false);
    expect(KO_PHASES).toHaveLength(PHASE_VALUES.length - 1);
  });
});

// ------------------------------------------------------------------
//  pronoFormSchema
// ------------------------------------------------------------------

describe('pronoFormSchema — scores', () => {
  const base = { phase: 'groupes' as const, vainqueur_tab: null };

  it('accepte un 2-1 en phase de groupes', () => {
    const r = pronoFormSchema.safeParse({ ...base, score_a: 2, score_b: 1 });
    expect(r.success).toBe(true);
  });

  it('rejette un score négatif', () => {
    const r = pronoFormSchema.safeParse({ ...base, score_a: -1, score_b: 0 });
    expect(firstMessage(r, 'score_a')).toBe('pronos.errors.scoreRange');
  });

  it('rejette un score > 99', () => {
    const r = pronoFormSchema.safeParse({ ...base, score_a: 0, score_b: 100 });
    expect(firstMessage(r, 'score_b')).toBe('pronos.errors.scoreRange');
  });

  it('rejette un score non entier', () => {
    const r = pronoFormSchema.safeParse({ ...base, score_a: 1.5, score_b: 0 });
    expect(firstMessage(r, 'score_a')).toBe('pronos.errors.scoreInteger');
  });

  it('rejette un score manquant', () => {
    const r = pronoFormSchema.safeParse({ ...base, score_b: 0 });
    expect(firstMessage(r, 'score_a')).toBe('pronos.errors.scoreRequired');
  });
});

describe('pronoFormSchema — vainqueur_tab (phase groupes)', () => {
  it('accepte vainqueur_tab=null sur égalité en groupes', () => {
    const r = pronoFormSchema.safeParse({
      phase: 'groupes',
      score_a: 1,
      score_b: 1,
      vainqueur_tab: null,
    });
    expect(r.success).toBe(true);
  });

  it('rejette vainqueur_tab="a" en phase de groupes', () => {
    const r = pronoFormSchema.safeParse({
      phase: 'groupes',
      score_a: 1,
      score_b: 1,
      vainqueur_tab: 'a',
    });
    expect(firstMessage(r, 'vainqueur_tab')).toBe(
      'pronos.errors.vainqueurTabNotAllowedGroupes',
    );
  });
});

describe('pronoFormSchema — vainqueur_tab (phases KO)', () => {
  it('KO + score différent → vainqueur_tab doit être null', () => {
    const r = pronoFormSchema.safeParse({
      phase: 'huitiemes',
      score_a: 2,
      score_b: 1,
      vainqueur_tab: null,
    });
    expect(r.success).toBe(true);
  });

  it('KO + égalité → vainqueur_tab requis', () => {
    const r = pronoFormSchema.safeParse({
      phase: 'finale',
      score_a: 1,
      score_b: 1,
      vainqueur_tab: null,
    });
    expect(firstMessage(r, 'vainqueur_tab')).toBe(
      'pronos.errors.vainqueurTabRequiredOnDraw',
    );
  });

  it('KO + égalité + vainqueur_tab renseigné → OK', () => {
    const r = pronoFormSchema.safeParse({
      phase: 'quarts',
      score_a: 0,
      score_b: 0,
      vainqueur_tab: 'b',
    });
    expect(r.success).toBe(true);
  });

  it('KO + score différent + vainqueur_tab renseigné → rejet', () => {
    const r = pronoFormSchema.safeParse({
      phase: 'demis',
      score_a: 3,
      score_b: 1,
      vainqueur_tab: 'a',
    });
    expect(firstMessage(r, 'vainqueur_tab')).toBe(
      'pronos.errors.vainqueurTabOnlyOnDraw',
    );
  });

  it("valide la règle pour chaque phase KO connue", () => {
    for (const phase of KO_PHASES) {
      const r = pronoFormSchema.safeParse({
        phase,
        score_a: 1,
        score_b: 1,
        vainqueur_tab: null,
      });
      expect(firstMessage(r, 'vainqueur_tab'), `phase=${phase}`).toBe(
        'pronos.errors.vainqueurTabRequiredOnDraw',
      );
    }
  });
});

// ------------------------------------------------------------------
//  upsertPronoSchema
// ------------------------------------------------------------------

describe('upsertPronoSchema', () => {
  const base = {
    concours_id: UUID_A,
    match_id: UUID_B,
    phase: 'groupes' as const,
    score_a: 1,
    score_b: 0,
    vainqueur_tab: null,
  };

  it('accepte un payload complet valide', () => {
    const r = upsertPronoSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it('rejette un concours_id non-uuid', () => {
    const r = upsertPronoSchema.safeParse({ ...base, concours_id: 'nope' });
    expect(firstMessage(r, 'concours_id')).toBe('pronos.errors.concoursRequired');
  });

  it('rejette un match_id non-uuid', () => {
    const r = upsertPronoSchema.safeParse({ ...base, match_id: 'nope' });
    expect(firstMessage(r, 'match_id')).toBe('pronos.errors.matchRequired');
  });

  it('partage le raffinement vainqueur_tab avec pronoFormSchema', () => {
    const r = upsertPronoSchema.safeParse({
      ...base,
      phase: 'finale',
      score_a: 2,
      score_b: 2,
      vainqueur_tab: null,
    });
    expect(firstMessage(r, 'vainqueur_tab')).toBe(
      'pronos.errors.vainqueurTabRequiredOnDraw',
    );
  });
});

// ------------------------------------------------------------------
//  deletePronoSchema
// ------------------------------------------------------------------

describe('deletePronoSchema', () => {
  it('accepte 2 uuids valides', () => {
    const r = deletePronoSchema.safeParse({
      concours_id: UUID_A,
      match_id: UUID_B,
    });
    expect(r.success).toBe(true);
  });

  it('rejette un concours_id vide', () => {
    const r = deletePronoSchema.safeParse({ concours_id: '', match_id: UUID_B });
    expect(firstMessage(r, 'concours_id')).toBe('pronos.errors.concoursRequired');
  });

  it('rejette un match_id vide', () => {
    const r = deletePronoSchema.safeParse({ concours_id: UUID_A, match_id: '' });
    expect(firstMessage(r, 'match_id')).toBe('pronos.errors.matchRequired');
  });
});
