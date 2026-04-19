import { mapAuthError } from '@/features/auth/errors';
import type {
  ForgotPasswordInput,
  LoginInput,
  MagicLinkInput,
  ResetPasswordInput,
  SignupInput,
} from '@/features/auth/schemas';
import { supabase } from '@/lib/supabase';

/**
 * Wrappers typés autour de `supabase.auth.*`.
 *
 * Chaque fonction **throw** un `TypedAuthError` en cas d'échec.
 * Les composants consomment ces wrappers via `useMutation` de TanStack Query.
 */

const getRedirectUrl = (path = '/auth/callback') => {
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
};

export const signInWithPassword = async ({ email, password }: LoginInput) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw mapAuthError(error);
  return data;
};

export const signUpWithPassword = async ({ email, password, prenom, nom }: SignupInput) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getRedirectUrl(),
      data: { prenom, nom, locale: 'fr' },
    },
  });
  if (error) throw mapAuthError(error);
  return data;
};

export const sendMagicLink = async ({ email }: MagicLinkInput) => {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: getRedirectUrl(),
      shouldCreateUser: false,
    },
  });
  if (error) throw mapAuthError(error);
};

export const sendResetPasswordEmail = async ({ email }: ForgotPasswordInput) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getRedirectUrl('/auth/reset-password'),
  });
  if (error) throw mapAuthError(error);
};

export const updatePassword = async ({ password }: ResetPasswordInput) => {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw mapAuthError(error);
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw mapAuthError(error);
};
