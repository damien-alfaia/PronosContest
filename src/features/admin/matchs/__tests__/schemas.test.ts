import { describe, expect, it } from 'vitest';

import {
  assignMatchTeamsSchema,
  MATCH_STATUS_VALUES,
  TERMINAL_HIATUS_STATUSES,
  updateMatchResultSchema,
  updateMatchStatusSchema,
  VAINQUEUR_TAB_VALUES,
} from '@/features/admin/matchs/schemas';

const MATCH = '11111111-1111-1111-1111-111111111111';
const EQA = '22222222-2222-2222-2222-222222222222';
const EQB = '33333333-3333-3333-3333-333333333333';

// ------------------------------------------------------------------
//  Constantes exportées
// ------------------------------------------------------------------

describe('MATCH_STATUS_VALUES', () => {
  it('contient les 5 statuts reconnus par la BDD', () => {
    expect(MATCH_STATUS_VALUES).toEqual([
      'scheduled',
      'live',
      'finished',
      'postponed',
      'cancelled',
    ]);
  });

  it('TERMINAL_HIATUS_STATUSES cible postponed + cancelled', () => {
    expect(TERMINAL_HIATUS_STATUSES).toEqual(['postponed', 'cancelled']);
  });

  it('VAINQUEUR_TAB_VALUES = [a, b]', () => {
    expect(VAINQUEUR_TAB_VALUES).toEqual(['a', 'b']);
  });
});

// ------------------------------------------------------------------
//  assignMatchTeamsSchema
// ------------------------------------------------------------------

describe('assignMatchTeamsSchema', () => {
  it('parse deux équipes distinctes', () => {
    const parsed = assignMatchTeamsSchema.parse({
      match_id: MATCH,
      equipe_a_id: EQA,
      equipe_b_id: EQB,
    });
    expect(parsed.equipe_a_id).toBe(EQA);
    expect(parsed.equipe_b_id).toBe(EQB);
  });

  it('accepte les deux null (désassignation complète d’un placeholder KO)', () => {
    const parsed = assignMatchTeamsSchema.parse({
      match_id: MATCH,
      equipe_a_id: null,
      equipe_b_id: null,
    });
    expect(parsed.equipe_a_id).toBeNull();
    expect(parsed.equipe_b_id).toBeNull();
  });

  it('accepte une seule équipe assignée (partiel)', () => {
    const parsed = assignMatchTeamsSchema.parse({
      match_id: MATCH,
      equipe_a_id: EQA,
      equipe_b_id: null,
    });
    expect(parsed.equipe_a_id).toBe(EQA);
    expect(parsed.equipe_b_id).toBeNull();
  });

  it('rejette deux fois la même équipe', () => {
    const result = assignMatchTeamsSchema.safeParse({
      match_id: MATCH,
      equipe_a_id: EQA,
      equipe_b_id: EQA,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['equipe_b_id']);
      expect(result.error.issues[0]?.message).toBe(
        'admin.errors.equipesMustDiffer',
      );
    }
  });

  it('rejette un match_id non-uuid', () => {
    const result = assignMatchTeamsSchema.safeParse({
      match_id: 'not-an-uuid',
      equipe_a_id: EQA,
      equipe_b_id: EQB,
    });
    expect(result.success).toBe(false);
  });
});

// ------------------------------------------------------------------
//  updateMatchResultSchema
// ------------------------------------------------------------------

describe('updateMatchResultSchema', () => {
  const base = {
    match_id: MATCH,
    phase: 'groupes' as const,
    score_a: 2,
    score_b: 1,
    vainqueur_tab: null,
    penalty_score_a: null,
    penalty_score_b: null,
    status: 'finished' as const,
  };

  it('parse un résultat de groupe valide', () => {
    const parsed = updateMatchResultSchema.parse(base);
    expect(parsed.score_a).toBe(2);
    expect(parsed.score_b).toBe(1);
    expect(parsed.status).toBe('finished');
  });

  it('accepte status=live', () => {
    const parsed = updateMatchResultSchema.parse({ ...base, status: 'live' });
    expect(parsed.status).toBe('live');
  });

  it('rejette un score négatif', () => {
    const result = updateMatchResultSchema.safeParse({ ...base, score_a: -1 });
    expect(result.success).toBe(false);
  });

  it('rejette un score > 99', () => {
    const result = updateMatchResultSchema.safeParse({ ...base, score_a: 100 });
    expect(result.success).toBe(false);
  });

  it('rejette un score non-entier', () => {
    const result = updateMatchResultSchema.safeParse({ ...base, score_a: 1.5 });
    expect(result.success).toBe(false);
  });

  it('rejette vainqueur_tab renseigné en phase de groupes', () => {
    const result = updateMatchResultSchema.safeParse({
      ...base,
      score_a: 1,
      score_b: 1,
      vainqueur_tab: 'a',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'admin.errors.vainqueurTabNotAllowedGroupes',
      );
    }
  });

  it('rejette un KO à égalité sans vainqueur_tab', () => {
    const result = updateMatchResultSchema.safeParse({
      ...base,
      phase: 'huitiemes',
      score_a: 1,
      score_b: 1,
      vainqueur_tab: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'admin.errors.vainqueurTabRequiredOnDraw',
      );
    }
  });

  it('accepte un KO à égalité avec vainqueur_tab', () => {
    const parsed = updateMatchResultSchema.parse({
      ...base,
      phase: 'finale',
      score_a: 1,
      score_b: 1,
      vainqueur_tab: 'a',
    });
    expect(parsed.vainqueur_tab).toBe('a');
  });

  it('rejette vainqueur_tab renseigné en KO sans égalité', () => {
    const result = updateMatchResultSchema.safeParse({
      ...base,
      phase: 'quarts',
      score_a: 2,
      score_b: 1,
      vainqueur_tab: 'a',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'admin.errors.vainqueurTabOnlyOnDraw',
      );
    }
  });

  it('accepte un KO sans égalité et sans vainqueur_tab', () => {
    const parsed = updateMatchResultSchema.parse({
      ...base,
      phase: 'demis',
      score_a: 3,
      score_b: 1,
      vainqueur_tab: null,
    });
    expect(parsed.vainqueur_tab).toBeNull();
  });

  it('accepte des pénos symétriques (les deux renseignés)', () => {
    const parsed = updateMatchResultSchema.parse({
      ...base,
      phase: 'finale',
      score_a: 1,
      score_b: 1,
      vainqueur_tab: 'a',
      penalty_score_a: 5,
      penalty_score_b: 4,
    });
    expect(parsed.penalty_score_a).toBe(5);
    expect(parsed.penalty_score_b).toBe(4);
  });

  it('rejette des pénos asymétriques (un seul renseigné)', () => {
    const result = updateMatchResultSchema.safeParse({
      ...base,
      phase: 'finale',
      score_a: 1,
      score_b: 1,
      vainqueur_tab: 'a',
      penalty_score_a: 5,
      penalty_score_b: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (i) => i.message === 'admin.errors.penaltyBothOrNone',
        ),
      ).toBe(true);
    }
  });

  it('rejette un péno > 30', () => {
    const result = updateMatchResultSchema.safeParse({
      ...base,
      phase: 'finale',
      score_a: 1,
      score_b: 1,
      vainqueur_tab: 'a',
      penalty_score_a: 5,
      penalty_score_b: 31,
    });
    expect(result.success).toBe(false);
  });

  it('default vainqueur_tab à null si omis', () => {
    const parsed = updateMatchResultSchema.parse({
      match_id: MATCH,
      phase: 'groupes',
      score_a: 2,
      score_b: 1,
      status: 'finished',
    });
    expect(parsed.vainqueur_tab).toBeNull();
    expect(parsed.penalty_score_a).toBeNull();
    expect(parsed.penalty_score_b).toBeNull();
  });
});

// ------------------------------------------------------------------
//  updateMatchStatusSchema
// ------------------------------------------------------------------

describe('updateMatchStatusSchema', () => {
  it('accepte scheduled / postponed / cancelled', () => {
    for (const status of ['scheduled', 'postponed', 'cancelled'] as const) {
      const parsed = updateMatchStatusSchema.parse({
        match_id: MATCH,
        status,
      });
      expect(parsed.status).toBe(status);
    }
  });

  it('rejette status=live (doit passer par updateMatchResultSchema)', () => {
    const result = updateMatchStatusSchema.safeParse({
      match_id: MATCH,
      status: 'live',
    });
    expect(result.success).toBe(false);
  });

  it('rejette status=finished (doit passer par updateMatchResultSchema)', () => {
    const result = updateMatchStatusSchema.safeParse({
      match_id: MATCH,
      status: 'finished',
    });
    expect(result.success).toBe(false);
  });
});
