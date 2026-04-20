import { describe, expect, it } from 'vitest';

import {
  classementRowSchema,
  computePronoTotal,
  normalizeClassementRow,
  normalizePronoPointsRow,
  pronoPointsRowSchema,
} from '@/features/classement/schemas';

const CONCOURS = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';
const MATCH = '33333333-3333-3333-3333-333333333333';

// ------------------------------------------------------------------
//  classementRowSchema + normalizeClassementRow
// ------------------------------------------------------------------

describe('classementRowSchema', () => {
  it('parse une ligne valide', () => {
    const parsed = classementRowSchema.parse({
      concours_id: CONCOURS,
      user_id: USER,
      rang: 1,
      points: 42,
      pronos_joues: 10,
      pronos_gagnes: 8,
      pronos_exacts: 3,
      prenom: 'Alice',
      nom: 'Martin',
      avatar_url: 'https://cdn/alice.png',
    });
    expect(parsed.rang).toBe(1);
    expect(parsed.points).toBe(42);
  });

  it('rejette un rang < 1', () => {
    const result = classementRowSchema.safeParse({
      concours_id: CONCOURS,
      user_id: USER,
      rang: 0,
      points: 0,
      pronos_joues: 0,
      pronos_gagnes: 0,
      pronos_exacts: 0,
      prenom: null,
      nom: null,
      avatar_url: null,
    });
    expect(result.success).toBe(false);
  });

  it('accepte prenom / nom / avatar_url null', () => {
    const parsed = classementRowSchema.parse({
      concours_id: CONCOURS,
      user_id: USER,
      rang: 5,
      points: 0,
      pronos_joues: 0,
      pronos_gagnes: 0,
      pronos_exacts: 0,
      prenom: null,
      nom: null,
      avatar_url: null,
    });
    expect(parsed.prenom).toBeNull();
    expect(parsed.nom).toBeNull();
    expect(parsed.avatar_url).toBeNull();
  });
});

describe('normalizeClassementRow', () => {
  it('coalesce les compteurs null à 0 et rang null à 1', () => {
    const row = normalizeClassementRow({
      concours_id: CONCOURS,
      user_id: USER,
      rang: null,
      points: null,
      pronos_joues: null,
      pronos_gagnes: null,
      pronos_exacts: null,
      prenom: null,
      nom: null,
      avatar_url: null,
    });
    expect(row).not.toBeNull();
    expect(row?.rang).toBe(1);
    expect(row?.points).toBe(0);
    expect(row?.pronos_joues).toBe(0);
    expect(row?.pronos_gagnes).toBe(0);
    expect(row?.pronos_exacts).toBe(0);
  });

  it('retourne null si concours_id manque', () => {
    const row = normalizeClassementRow({
      concours_id: null,
      user_id: USER,
      rang: 1,
      points: 0,
      pronos_joues: 0,
      pronos_gagnes: 0,
      pronos_exacts: 0,
      prenom: null,
      nom: null,
      avatar_url: null,
    });
    expect(row).toBeNull();
  });

  it('retourne null si user_id manque', () => {
    const row = normalizeClassementRow({
      concours_id: CONCOURS,
      user_id: null,
      rang: 1,
      points: 0,
      pronos_joues: 0,
      pronos_gagnes: 0,
      pronos_exacts: 0,
      prenom: null,
      nom: null,
      avatar_url: null,
    });
    expect(row).toBeNull();
  });

  it('préserve prenom / nom / avatar_url quand fournis', () => {
    const row = normalizeClassementRow({
      concours_id: CONCOURS,
      user_id: USER,
      rang: 2,
      points: 12,
      pronos_joues: 4,
      pronos_gagnes: 2,
      pronos_exacts: 1,
      prenom: 'Bob',
      nom: 'Dupont',
      avatar_url: 'https://cdn/bob.png',
    });
    expect(row?.prenom).toBe('Bob');
    expect(row?.nom).toBe('Dupont');
    expect(row?.avatar_url).toBe('https://cdn/bob.png');
  });
});

// ------------------------------------------------------------------
//  pronoPointsRowSchema + normalizePronoPointsRow
// ------------------------------------------------------------------

describe('pronoPointsRowSchema', () => {
  it('parse une ligne finale + exacte avec cote', () => {
    const parsed = pronoPointsRowSchema.parse({
      concours_id: CONCOURS,
      user_id: USER,
      match_id: MATCH,
      phase: 'groupes',
      match_status: 'finished',
      is_final: true,
      is_exact: true,
      points_base: 3,
      bonus_ko: 0,
      cote_appliquee: 2.5,
    });
    expect(parsed.is_final).toBe(true);
    expect(parsed.cote_appliquee).toBe(2.5);
  });

  it('rejette une phase hors enum', () => {
    const result = pronoPointsRowSchema.safeParse({
      concours_id: CONCOURS,
      user_id: USER,
      match_id: MATCH,
      phase: 'mystery-phase',
      match_status: 'finished',
      is_final: true,
      is_exact: false,
      points_base: 0,
      bonus_ko: 0,
      cote_appliquee: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejette une cote < 1.00', () => {
    const result = pronoPointsRowSchema.safeParse({
      concours_id: CONCOURS,
      user_id: USER,
      match_id: MATCH,
      phase: 'groupes',
      match_status: 'finished',
      is_final: true,
      is_exact: false,
      points_base: 1,
      bonus_ko: 0,
      cote_appliquee: 0.5,
    });
    expect(result.success).toBe(false);
  });
});

describe('normalizePronoPointsRow', () => {
  it('retourne null si match_id manque', () => {
    const row = normalizePronoPointsRow({
      concours_id: CONCOURS,
      user_id: USER,
      match_id: null,
      phase: 'groupes',
      match_status: 'finished',
      is_final: true,
      is_exact: false,
      points_base: 1,
      bonus_ko: 0,
      cote_appliquee: null,
    });
    expect(row).toBeNull();
  });

  it('coalesce is_final / is_exact null à false', () => {
    const row = normalizePronoPointsRow({
      concours_id: CONCOURS,
      user_id: USER,
      match_id: MATCH,
      phase: 'groupes',
      match_status: 'scheduled',
      is_final: null,
      is_exact: null,
      points_base: null,
      bonus_ko: null,
      cote_appliquee: null,
    });
    expect(row).not.toBeNull();
    expect(row?.is_final).toBe(false);
    expect(row?.is_exact).toBe(false);
    expect(row?.points_base).toBe(0);
    expect(row?.bonus_ko).toBe(0);
    expect(row?.cote_appliquee).toBeNull();
  });
});

// ------------------------------------------------------------------
//  computePronoTotal
// ------------------------------------------------------------------

describe('computePronoTotal', () => {
  it('retourne 0 si is_final=false', () => {
    const total = computePronoTotal({
      concours_id: CONCOURS,
      user_id: USER,
      match_id: MATCH,
      phase: 'groupes',
      match_status: 'scheduled',
      is_final: false,
      is_exact: false,
      points_base: 3,
      bonus_ko: 0,
      cote_appliquee: null,
    });
    expect(total).toBe(0);
  });

  it('applique la cote en multiplicateur quand fournie', () => {
    const total = computePronoTotal({
      concours_id: CONCOURS,
      user_id: USER,
      match_id: MATCH,
      phase: 'groupes',
      match_status: 'finished',
      is_final: true,
      is_exact: true,
      points_base: 3,
      bonus_ko: 0,
      cote_appliquee: 2.0,
    });
    expect(total).toBe(6);
  });

  it('traite cote null comme 1 (pas de multiplicateur)', () => {
    const total = computePronoTotal({
      concours_id: CONCOURS,
      user_id: USER,
      match_id: MATCH,
      phase: 'groupes',
      match_status: 'finished',
      is_final: true,
      is_exact: true,
      points_base: 3,
      bonus_ko: 0,
      cote_appliquee: null,
    });
    expect(total).toBe(3);
  });

  it('additionne bonus_ko avant la multiplication', () => {
    // base 3 + bonus 2 = 5, cote 2.0 -> 10
    const total = computePronoTotal({
      concours_id: CONCOURS,
      user_id: USER,
      match_id: MATCH,
      phase: 'finale',
      match_status: 'finished',
      is_final: true,
      is_exact: true,
      points_base: 3,
      bonus_ko: 2,
      cote_appliquee: 2.0,
    });
    expect(total).toBe(10);
  });

  it('arrondit à l’entier (round, pas floor)', () => {
    // 3 * 1.55 = 4.65 -> 5
    const total = computePronoTotal({
      concours_id: CONCOURS,
      user_id: USER,
      match_id: MATCH,
      phase: 'groupes',
      match_status: 'finished',
      is_final: true,
      is_exact: false,
      points_base: 3,
      bonus_ko: 0,
      cote_appliquee: 1.55,
    });
    expect(total).toBe(5);
  });
});
