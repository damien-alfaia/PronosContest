import { describe, expect, it } from 'vitest';
import type { SafeParseReturnType } from 'zod';

import {
  forgotPasswordSchema,
  loginSchema,
  magicLinkSchema,
  resetPasswordSchema,
  signupSchema,
} from '@/features/auth/schemas';

const firstMessage = <I, O>(result: SafeParseReturnType<I, O>, path: string) => {
  if (result.success) return null;
  const issue = result.error.issues.find((i) => i.path.join('.') === path);
  return issue?.message ?? null;
};

describe('loginSchema', () => {
  it('accepte email + password valides', () => {
    const r = loginSchema.safeParse({ email: 'a@b.co', password: 'password123' });
    expect(r.success).toBe(true);
  });

  it('rejette email invalide', () => {
    const r = loginSchema.safeParse({ email: 'pas-un-email', password: 'password123' });
    expect(firstMessage(r, 'email')).toBe('auth.errors.invalidEmail');
  });

  it('rejette email vide', () => {
    const r = loginSchema.safeParse({ email: '', password: 'password123' });
    expect(firstMessage(r, 'email')).toBe('auth.errors.invalidEmail');
  });

  it('rejette password < 8', () => {
    const r = loginSchema.safeParse({ email: 'a@b.co', password: 'short' });
    expect(firstMessage(r, 'password')).toBe('auth.errors.passwordTooShort');
  });

  it('trim les emails', () => {
    const r = loginSchema.safeParse({ email: '  a@b.co  ', password: 'password123' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('a@b.co');
  });
});

describe('signupSchema', () => {
  const base = {
    email: 'a@b.co',
    password: 'password123',
    prenom: 'Ada',
    nom: 'Lovelace',
  };

  it('accepte un signup complet', () => {
    expect(signupSchema.safeParse(base).success).toBe(true);
  });

  it('requiert prenom', () => {
    const r = signupSchema.safeParse({ ...base, prenom: '' });
    expect(firstMessage(r, 'prenom')).toBe('auth.errors.firstNameRequired');
  });

  it('requiert nom', () => {
    const r = signupSchema.safeParse({ ...base, nom: '   ' });
    expect(firstMessage(r, 'nom')).toBe('auth.errors.lastNameRequired');
  });

  it('rejette password > 72', () => {
    const r = signupSchema.safeParse({ ...base, password: 'x'.repeat(73) });
    expect(firstMessage(r, 'password')).toBe('auth.errors.passwordTooLong');
  });
});

describe('magicLinkSchema / forgotPasswordSchema', () => {
  it('exigent un email valide', () => {
    expect(magicLinkSchema.safeParse({ email: 'a@b.co' }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: 'pas-un-email' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('accepte deux passwords identiques', () => {
    const r = resetPasswordSchema.safeParse({
      password: 'password123',
      confirmPassword: 'password123',
    });
    expect(r.success).toBe(true);
  });

  it('rejette deux passwords différents', () => {
    const r = resetPasswordSchema.safeParse({
      password: 'password123',
      confirmPassword: 'password456',
    });
    expect(firstMessage(r, 'confirmPassword')).toBe('auth.errors.passwordsDontMatch');
  });
});
