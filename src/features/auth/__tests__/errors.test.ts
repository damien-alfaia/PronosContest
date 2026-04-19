import { AuthError as SupabaseAuthError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { mapAuthError } from '@/features/auth/errors';

const makeSupabaseError = (message: string, code?: string) => {
  // AuthError est une classe à deux args selon les versions — on passe par un cast
  // pour rester robuste à l'évolution du constructeur.
  const err = new SupabaseAuthError(message);
  if (code) {
    (err as unknown as { code: string }).code = code;
  }
  return err;
};

describe('mapAuthError', () => {
  it('détecte invalid_credentials via message', () => {
    const r = mapAuthError(makeSupabaseError('Invalid login credentials'));
    expect(r.code).toBe('invalid_credentials');
    expect(r.i18nKey).toBe('auth.errors.invalidCredentials');
  });

  it('détecte invalid_credentials via code', () => {
    const r = mapAuthError(makeSupabaseError('x', 'invalid_credentials'));
    expect(r.code).toBe('invalid_credentials');
  });

  it('détecte email_not_confirmed', () => {
    const r = mapAuthError(makeSupabaseError('Email not confirmed'));
    expect(r.code).toBe('email_not_confirmed');
  });

  it('détecte user_already_exists (plusieurs messages Supabase)', () => {
    expect(mapAuthError(makeSupabaseError('User already registered')).code).toBe(
      'user_already_exists',
    );
    expect(
      mapAuthError(makeSupabaseError('Email has already been registered')).code,
    ).toBe('user_already_exists');
  });

  it('détecte weak_password', () => {
    const r = mapAuthError(
      makeSupabaseError('Password should be at least 6 characters'),
    );
    expect(r.code).toBe('weak_password');
  });

  it('détecte rate_limited', () => {
    const r = mapAuthError(makeSupabaseError('Email rate limit exceeded'));
    expect(r.code).toBe('rate_limited');
  });

  it('détecte network sur Failed to fetch', () => {
    const r = mapAuthError(new TypeError('Failed to fetch'));
    expect(r.code).toBe('network');
    expect(r.i18nKey).toBe('auth.errors.network');
  });

  it('fallback unknown pour une erreur inconnue', () => {
    const r = mapAuthError(new Error('Strange thing happened'));
    expect(r.code).toBe('unknown');
    expect(r.i18nKey).toBe('auth.errors.unknown');
  });

  it('ne lève jamais, même sur null/undefined', () => {
    expect(() => mapAuthError(null)).not.toThrow();
    expect(() => mapAuthError(undefined)).not.toThrow();
    expect(mapAuthError(null).code).toBe('unknown');
  });
});
