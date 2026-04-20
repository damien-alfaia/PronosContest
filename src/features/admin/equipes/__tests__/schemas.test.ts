import { describe, expect, it } from 'vitest';

import { equipeUpsertSchema } from '@/features/admin/equipes/schemas';

/**
 * Tests unitaires du `equipeUpsertSchema`.
 *
 * Couverture :
 *   - `competition_id` UUID obligatoire,
 *   - `code` : regex `[A-Z0-9]+` strict (2..10 chars),
 *   - `nom` bornes 2..80,
 *   - `groupe` preprocess (uppercase, trim, "" → null, regex une lettre),
 *   - `drapeau_url` URL ou null,
 *   - `fifa_id` preprocess ("" → null, string → number int, >= 1).
 */

const COMP = '22222222-0000-0000-0000-000000000001';

const validPayload = {
  competition_id: COMP,
  code: 'FRA',
  nom: 'France',
  groupe: 'A',
  drapeau_url: 'https://example.com/fr.svg',
  fifa_id: 103,
};

describe('equipeUpsertSchema', () => {
  it('accepte un payload valide complet', () => {
    const r = equipeUpsertSchema.safeParse(validPayload);
    expect(r.success).toBe(true);
  });

  it('accepte un payload minimal (groupe/drapeau/fifa_id null)', () => {
    const r = equipeUpsertSchema.safeParse({
      ...validPayload,
      groupe: null,
      drapeau_url: null,
      fifa_id: null,
    });
    expect(r.success).toBe(true);
  });

  // ----- competition_id -----

  it('rejette competition_id non UUID', () => {
    const r = equipeUpsertSchema.safeParse({
      ...validPayload,
      competition_id: 'not-a-uuid',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe(
        'admin.errors.competitionRequired',
      );
    }
  });

  // ----- code -----

  it('rejette code trop court', () => {
    const r = equipeUpsertSchema.safeParse({ ...validPayload, code: 'F' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe('admin.errors.teamCodeTooShort');
    }
  });

  it('rejette code trop long (>10)', () => {
    const r = equipeUpsertSchema.safeParse({
      ...validPayload,
      code: 'ABCDEFGHIJK',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe('admin.errors.teamCodeTooLong');
    }
  });

  it('rejette code avec minuscules / espaces / tirets', () => {
    for (const code of ['fra', 'FR-A', 'FR A', 'FR_A']) {
      const r = equipeUpsertSchema.safeParse({ ...validPayload, code });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0]?.message).toBe(
          'admin.errors.teamCodeFormat',
        );
      }
    }
  });

  it('accepte un code rugby en 2 lettres (FJ, FI)', () => {
    for (const code of ['FJ', 'FI']) {
      const r = equipeUpsertSchema.safeParse({ ...validPayload, code });
      expect(r.success).toBe(true);
    }
  });

  // ----- nom -----

  it('rejette nom trop court', () => {
    const r = equipeUpsertSchema.safeParse({ ...validPayload, nom: 'F' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe('admin.errors.nomTooShort');
    }
  });

  it('rejette nom trop long (>80)', () => {
    const r = equipeUpsertSchema.safeParse({
      ...validPayload,
      nom: 'x'.repeat(81),
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe('admin.errors.nomTooLong');
    }
  });

  // ----- groupe -----

  it('preprocess minuscule "a" → "A" accepté', () => {
    const r = equipeUpsertSchema.safeParse({ ...validPayload, groupe: 'a' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.groupe).toBe('A');
  });

  it('preprocess "" → null (groupe vide accepté)', () => {
    const r = equipeUpsertSchema.safeParse({
      ...validPayload,
      groupe: '',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.groupe).toBeNull();
  });

  it('preprocess whitespace → null', () => {
    const r = equipeUpsertSchema.safeParse({
      ...validPayload,
      groupe: '   ',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.groupe).toBeNull();
  });

  it('rejette groupe multi-caractères', () => {
    const r = equipeUpsertSchema.safeParse({ ...validPayload, groupe: 'AA' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe('admin.errors.groupeFormat');
    }
  });

  it('rejette groupe chiffre', () => {
    const r = equipeUpsertSchema.safeParse({ ...validPayload, groupe: '1' });
    expect(r.success).toBe(false);
  });

  // ----- drapeau_url -----

  it('rejette drapeau_url non URL', () => {
    const r = equipeUpsertSchema.safeParse({
      ...validPayload,
      drapeau_url: 'nope',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe('admin.errors.drapeauUrlFormat');
    }
  });

  it('preprocess drapeau_url "" → null', () => {
    const r = equipeUpsertSchema.safeParse({
      ...validPayload,
      drapeau_url: '',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.drapeau_url).toBeNull();
  });

  // ----- fifa_id -----

  it('preprocess string "103" → number 103', () => {
    const r = equipeUpsertSchema.safeParse({
      ...validPayload,
      fifa_id: '103',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.fifa_id).toBe(103);
  });

  it('preprocess "" → null', () => {
    const r = equipeUpsertSchema.safeParse({
      ...validPayload,
      fifa_id: '',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.fifa_id).toBeNull();
  });

  it('rejette fifa_id < 1', () => {
    const r = equipeUpsertSchema.safeParse({ ...validPayload, fifa_id: 0 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe('admin.errors.fifaIdRange');
    }
  });

  it('rejette fifa_id non entier', () => {
    const r = equipeUpsertSchema.safeParse({ ...validPayload, fifa_id: 1.5 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe('admin.errors.fifaIdInteger');
    }
  });
});
