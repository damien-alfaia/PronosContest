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
      prono_points: 42,
      challenge_delta: 0,
      pronos_joues: 10,
      pronos_gagnes: 8,
      pronos_exacts: 3,
      prenom: 'Alice',
      nom: 'Martin',
      avatar_url: 'https://cdn/alice.png',
    });
    expect(parsed.rang).toBe(1);
    expect(parsed.points).toBe(42);
    expect(parsed.prono_points).toBe(42);
    expect(parsed.challenge_delta).toBe(0);
  });

  it('rejette un rang < 1', () => {
    const result = classementRowSchema.safeParse({
      concours_id: CONCOURS,
      user_id: USER,
      rang: 0,
      points: 0,
      prono_points: 0,
      challenge_delta: 0,
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
      prono_points: 0,
      challenge_delta: 0,
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

  it('accepte un challenge_delta négatif', () => {
    const parsed = classementRowSchema.parse({
      concours_id: CONCOURS,
      user_id: USER,
      rang: 1,
      points: 15,
      prono_points: 25,
      challenge_delta: -10,
      pronos_joues: 5,
      pronos_gagnes: 3,
      pronos_exacts: 1,
      prenom: null,
      nom: null,
      avatar_url: null,
    });
    expect(parsed.challenge_delta).toBe(-10);
    expect(parsed.points).toBe(15);
  });

  it('accepte points négatif (delta challenge > prono_points)', () => {
    // `prono_points ≥ 0` par définition, mais `points` peut théoriquement
    // être < 0 si les transferts challenge dépassent les points pronos.
    // Le schema n'applique pas de floor côté Zod pour refléter la vue SQL.
    const parsed = classementRowSchema.parse({
      concours_id: CONCOURS,
      user_id: USER,
      rang: 10,
      points: -5,
      prono_points: 5,
      challenge_delta: -10,
      pronos_joues: 2,
      pronos_gagnes: 1,
      pronos_exacts: 0,
      prenom: null,
      nom: null,
      avatar_url: null,
    });
    expect(parsed.points).toBe(-5);
  });

  it('rejette un prono_points négatif', () => {
    // `prono_points` est la somme des `points_final` ≥ 0 côté vue,
    // donc jamais négatif. Le Zod sentinelle le garantit.
    const result = classementRowSchema.safeParse({
      concours_id: CONCOURS,
      user_id: USER,
      rang: 1,
      points: 0,
      prono_points: -1,
      challenge_delta: 0,
      pronos_joues: 0,
      pronos_gagnes: 0,
      pronos_exacts: 0,
      prenom: null,
      nom: null,
      avatar_url: null,
    });
    expect(result.success).toBe(false);
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
    // prono_points fallback = max(0, points - challenge_delta) = 0
    expect(row?.prono_points).toBe(0);
    // challenge_delta fallback = 0
    expect(row?.challenge_delta).toBe(0);
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

  it('préserve prono_points et challenge_delta quand fournis par la vue', () => {
    const row = normalizeClassementRow({
      concours_id: CONCOURS,
      user_id: USER,
      rang: 1,
      points: 47,
      prono_points: 52,
      challenge_delta: -5,
      pronos_joues: 10,
      pronos_gagnes: 7,
      pronos_exacts: 3,
      prenom: 'Alice',
      nom: 'Martin',
      avatar_url: null,
    });
    expect(row?.points).toBe(47);
    expect(row?.prono_points).toBe(52);
    expect(row?.challenge_delta).toBe(-5);
  });

  it('fallback rétrocompat : prono_points recalculé depuis points - challenge_delta', () => {
    // Quand la vue n'a pas encore été régénérée (`supabase gen types`
    // pas rejoué), `prono_points` et `challenge_delta` peuvent être
    // `undefined`. Le normalizer doit reconstruire un break-down cohérent.
    const row = normalizeClassementRow({
      concours_id: CONCOURS,
      user_id: USER,
      rang: 1,
      points: 42,
      pronos_joues: 8,
      pronos_gagnes: 6,
      pronos_exacts: 2,
      prenom: null,
      nom: null,
      avatar_url: null,
    });
    expect(row?.points).toBe(42);
    // Pas de challenge_delta → 0
    expect(row?.challenge_delta).toBe(0);
    // prono_points = max(0, 42 - 0) = 42
    expect(row?.prono_points).toBe(42);
  });

  it('fallback rétrocompat : prono_points clampé à 0 si points < 0', () => {
    // Si la vue legacy renvoie points=-5 (delta négatif non exposé),
    // on ne veut pas que prono_points devienne négatif en fallback.
    const row = normalizeClassementRow({
      concours_id: CONCOURS,
      user_id: USER,
      rang: 1,
      points: -5,
      pronos_joues: 0,
      pronos_gagnes: 0,
      pronos_exacts: 0,
      prenom: null,
      nom: null,
      avatar_url: null,
    });
    expect(row?.points).toBe(-5);
    expect(row?.challenge_delta).toBe(0);
    // Math.max(0, -5 - 0) = 0
    expect(row?.prono_points).toBe(0);
  });

  it('accepte prono_points + challenge_delta null explicites → fallback', () => {
    const row = normalizeClassementRow({
      concours_id: CONCOURS,
      user_id: USER,
      rang: 1,
      points: 30,
      prono_points: null,
      challenge_delta: null,
      pronos_joues: 5,
      pronos_gagnes: 4,
      pronos_exacts: 2,
      prenom: null,
      nom: null,
      avatar_url: null,
    });
    expect(row?.challenge_delta).toBe(0);
    expect(row?.prono_points).toBe(30);
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
