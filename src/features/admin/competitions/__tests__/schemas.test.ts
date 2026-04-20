import { describe, expect, it } from 'vitest';

import {
  competitionUpsertSchema,
  COMPETITION_STATUS_VALUES,
  SPORT_VALUES,
} from '@/features/admin/competitions/schemas';

/**
 * Tests unitaires du `competitionUpsertSchema`.
 *
 * Couverture :
 *   - champs obligatoires (code, nom, sport, status),
 *   - contraintes de format (`code` slug, `nom` bornes, `logo_url` URL),
 *   - preprocess des dates ("" / whitespace → null, regex YYYY-MM-DD),
 *   - CHECK `date_fin >= date_debut` en miroir du SQL,
 *   - valeurs d'enum (sport/status).
 */

const validPayload = {
  code: 'fifa-wc-2026',
  nom: 'FIFA World Cup 2026',
  sport: 'football' as const,
  status: 'upcoming' as const,
  date_debut: '2026-06-11',
  date_fin: '2026-07-19',
  logo_url: 'https://example.com/logo.png',
};

describe('competitionUpsertSchema', () => {
  it('accepte un payload valide complet', () => {
    const r = competitionUpsertSchema.safeParse(validPayload);
    expect(r.success).toBe(true);
  });

  it('accepte un payload minimal (dates null, logo_url null)', () => {
    const r = competitionUpsertSchema.safeParse({
      ...validPayload,
      date_debut: null,
      date_fin: null,
      logo_url: null,
    });
    expect(r.success).toBe(true);
  });

  it('normalise "" → null pour date_debut / date_fin / logo_url', () => {
    const r = competitionUpsertSchema.safeParse({
      ...validPayload,
      date_debut: '',
      date_fin: '   ',
      logo_url: '',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.date_debut).toBeNull();
      expect(r.data.date_fin).toBeNull();
      expect(r.data.logo_url).toBeNull();
    }
  });

  // ----- code -----

  it('rejette code trop court', () => {
    const r = competitionUpsertSchema.safeParse({ ...validPayload, code: 'a' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe('admin.errors.codeTooShort');
    }
  });

  it('rejette code trop long', () => {
    const r = competitionUpsertSchema.safeParse({
      ...validPayload,
      code: 'a'.repeat(41),
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe('admin.errors.codeTooLong');
    }
  });

  it('rejette code avec majuscules ou caractères spéciaux', () => {
    for (const code of ['FIFA-WC', 'fifa wc', 'fifa_wc', 'fifa.wc']) {
      const r = competitionUpsertSchema.safeParse({ ...validPayload, code });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0]?.message).toBe(
          'admin.errors.codeSlugFormat',
        );
      }
    }
  });

  // ----- nom -----

  it('rejette nom trop court', () => {
    const r = competitionUpsertSchema.safeParse({ ...validPayload, nom: 'X' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe('admin.errors.nomTooShort');
    }
  });

  it('rejette nom trop long', () => {
    const r = competitionUpsertSchema.safeParse({
      ...validPayload,
      nom: 'x'.repeat(121),
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe('admin.errors.nomTooLong');
    }
  });

  // ----- sport / status -----

  it('rejette sport hors enum', () => {
    const r = competitionUpsertSchema.safeParse({
      ...validPayload,
      sport: 'basket',
    });
    expect(r.success).toBe(false);
  });

  it('rejette status hors enum', () => {
    const r = competitionUpsertSchema.safeParse({
      ...validPayload,
      status: 'pending',
    });
    expect(r.success).toBe(false);
  });

  it('accepte tous les sports enum', () => {
    for (const sport of SPORT_VALUES) {
      const r = competitionUpsertSchema.safeParse({ ...validPayload, sport });
      expect(r.success).toBe(true);
    }
  });

  it('accepte tous les status enum', () => {
    for (const status of COMPETITION_STATUS_VALUES) {
      const r = competitionUpsertSchema.safeParse({
        ...validPayload,
        status,
      });
      expect(r.success).toBe(true);
    }
  });

  // ----- dates -----

  it('rejette un format de date invalide', () => {
    const r = competitionUpsertSchema.safeParse({
      ...validPayload,
      date_debut: '11/06/2026',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) => i.message === 'admin.errors.dateFormat'),
      ).toBe(true);
    }
  });

  it('rejette date_fin antérieure à date_debut (CHECK SQL miroir)', () => {
    const r = competitionUpsertSchema.safeParse({
      ...validPayload,
      date_debut: '2026-07-19',
      date_fin: '2026-06-11',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe(
        'admin.errors.dateFinBeforeDebut',
      );
      expect(r.error.issues[0]?.path).toEqual(['date_fin']);
    }
  });

  it('accepte date_fin === date_debut (même jour = OK)', () => {
    const r = competitionUpsertSchema.safeParse({
      ...validPayload,
      date_debut: '2026-06-11',
      date_fin: '2026-06-11',
    });
    expect(r.success).toBe(true);
  });

  it('accepte date_debut seule (date_fin null)', () => {
    const r = competitionUpsertSchema.safeParse({
      ...validPayload,
      date_debut: '2026-06-11',
      date_fin: null,
    });
    expect(r.success).toBe(true);
  });

  // ----- logo_url -----

  it('rejette logo_url non URL', () => {
    const r = competitionUpsertSchema.safeParse({
      ...validPayload,
      logo_url: 'pas-une-url',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe('admin.errors.logoUrlFormat');
    }
  });
});
