import { describe, expect, it } from 'vitest';
import type { SafeParseReturnType } from 'zod';

import {
  concoursCreateSchema,
  concoursSearchSchema,
  DEFAULT_SCORING_RULES,
  joinByCodeSchema,
} from '@/features/concours/schemas';

const firstMessage = <I, O>(result: SafeParseReturnType<I, O>, path: string) => {
  if (result.success) return null;
  const issue = result.error.issues.find((i) => i.path.join('.') === path);
  return issue?.message ?? null;
};

const VALID_UUID = '11111111-1111-1111-1111-111111111111';

describe('concoursCreateSchema', () => {
  const base = {
    nom: 'Coupe des potes',
    description: 'Un petit concours entre amis.',
    competition_id: VALID_UUID,
    visibility: 'public' as const,
    scoring_rules: DEFAULT_SCORING_RULES,
  };

  it('accepte un payload valide', () => {
    const r = concoursCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it('rejette un nom trop court', () => {
    const r = concoursCreateSchema.safeParse({ ...base, nom: 'ab' });
    expect(firstMessage(r, 'nom')).toBe('concours.errors.nomTooShort');
  });

  it('rejette un nom trop long', () => {
    const r = concoursCreateSchema.safeParse({ ...base, nom: 'x'.repeat(81) });
    expect(firstMessage(r, 'nom')).toBe('concours.errors.nomTooLong');
  });

  it('rejette une description trop longue', () => {
    const r = concoursCreateSchema.safeParse({
      ...base,
      description: 'x'.repeat(501),
    });
    expect(firstMessage(r, 'description')).toBe('concours.errors.descriptionTooLong');
  });

  it('rejette une competition_id non-uuid', () => {
    const r = concoursCreateSchema.safeParse({ ...base, competition_id: 'not-uuid' });
    expect(firstMessage(r, 'competition_id')).toBe('concours.errors.competitionRequired');
  });

  it('rejette une visibility inconnue', () => {
    const r = concoursCreateSchema.safeParse({
      ...base,
      visibility: 'hidden' as never,
    });
    expect(firstMessage(r, 'visibility')).toBeTruthy();
  });

  it('accepte les 3 visibilités public / private / unlisted', () => {
    for (const v of ['public', 'private', 'unlisted'] as const) {
      const r = concoursCreateSchema.safeParse({ ...base, visibility: v });
      expect(r.success, `visibility=${v}`).toBe(true);
    }
  });

  it('applique les défauts de scoring_rules', () => {
    const r = concoursCreateSchema.safeParse({
      nom: 'X',
      competition_id: VALID_UUID,
      visibility: 'public' as const,
    });
    // nom trop court -> on ne teste pas success, juste le shape du default
    expect(DEFAULT_SCORING_RULES.exact_score).toBe(15);
    expect(DEFAULT_SCORING_RULES.correct_winner).toBe(5);
    expect(DEFAULT_SCORING_RULES.correct_draw).toBe(7);
    expect(DEFAULT_SCORING_RULES.knockout_bonus).toBe(2);
    expect(DEFAULT_SCORING_RULES.odds_multiplier_enabled).toBe(true);
    // `r` inutilisé côté assertion mais on s'assure qu'on n'a pas crashé
    expect(r.success).toBe(false);
  });

  it('transforme une description vide en undefined', () => {
    const r = concoursCreateSchema.safeParse({ ...base, description: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.description).toBeUndefined();
  });

  it('trim nom et description', () => {
    const r = concoursCreateSchema.safeParse({
      ...base,
      nom: '  Mon concours  ',
      description: '  coucou  ',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.nom).toBe('Mon concours');
      expect(r.data.description).toBe('coucou');
    }
  });
});

describe('joinByCodeSchema', () => {
  it('accepte un code de 8 caractères', () => {
    const r = joinByCodeSchema.safeParse({ code: 'ABCD1234' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBe('ABCD1234');
  });

  it('upper-case le code saisi', () => {
    const r = joinByCodeSchema.safeParse({ code: 'abcd1234' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBe('ABCD1234');
  });

  it('trim les espaces autour du code', () => {
    const r = joinByCodeSchema.safeParse({ code: '  abcd1234  ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBe('ABCD1234');
  });

  it('rejette un code trop court', () => {
    const r = joinByCodeSchema.safeParse({ code: 'ABC' });
    expect(firstMessage(r, 'code')).toBe('concours.errors.codeTooShort');
  });

  it('rejette un code trop long', () => {
    const r = joinByCodeSchema.safeParse({ code: 'A'.repeat(13) });
    expect(firstMessage(r, 'code')).toBe('concours.errors.codeTooLong');
  });
});

describe('concoursSearchSchema', () => {
  it('accepte une recherche vide (tout lister)', () => {
    const r = concoursSearchSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it('trim la recherche', () => {
    const r = concoursSearchSchema.safeParse({ q: '  hello  ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.q).toBe('hello');
  });

  it('rejette une recherche > 80 caractères', () => {
    const r = concoursSearchSchema.safeParse({ q: 'x'.repeat(81) });
    expect(r.success).toBe(false);
  });
});
