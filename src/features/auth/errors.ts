import { AuthError as SupabaseAuthError } from '@supabase/supabase-js';

/**
 * Erreurs d'auth typées côté client, orientées UX.
 *
 * On refuse catégoriquement `catch (e: any)`. Toute erreur qui remonte d'un
 * appel `supabase.auth.*` passe par `mapAuthError()` qui renvoie ce type.
 */

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'user_already_exists'
  | 'weak_password'
  | 'rate_limited'
  | 'invalid_or_expired_link'
  | 'network'
  | 'unknown';

export type TypedAuthError = {
  code: AuthErrorCode;
  /** Message brut (Supabase ou JS). Pratique pour le debug, **pas** à afficher tel quel. */
  rawMessage: string;
  /** Clé i18n à passer à `t()` pour afficher le message utilisateur. */
  i18nKey: string;
};

/** Est-ce une `Error` (TypeError, Error, SupabaseAuthError…) ? */
const isError = (e: unknown): e is Error =>
  e instanceof Error || (typeof e === 'object' && e !== null && 'message' in e);

/**
 * Mappe n'importe quelle valeur inconnue vers une erreur typée.
 *
 * Ne lève **jamais** — toujours un objet exploitable.
 */
export const mapAuthError = (err: unknown): TypedAuthError => {
  const rawMessage = isError(err) ? err.message : String(err);
  const lower = rawMessage.toLowerCase();

  // Network (fetch failed, offline, DNS…)
  if (lower.includes('fetch') || lower.includes('network') || lower.includes('failed to fetch')) {
    return { code: 'network', rawMessage, i18nKey: 'auth.errors.network' };
  }

  if (err instanceof SupabaseAuthError) {
    // Supabase Go-True expose un `code` / status + un message libre.
    // On s'appuie d'abord sur `err.code` quand dispo, sinon on pattern-match le message.
    const code = (err as { code?: string }).code ?? '';

    if (code === 'invalid_credentials' || lower.includes('invalid login credentials')) {
      return { code: 'invalid_credentials', rawMessage, i18nKey: 'auth.errors.invalidCredentials' };
    }
    if (code === 'email_not_confirmed' || lower.includes('email not confirmed')) {
      return { code: 'email_not_confirmed', rawMessage, i18nKey: 'auth.errors.emailNotConfirmed' };
    }
    if (
      code === 'user_already_exists' ||
      lower.includes('already registered') ||
      lower.includes('user already exists') ||
      lower.includes('already been registered')
    ) {
      return { code: 'user_already_exists', rawMessage, i18nKey: 'auth.errors.userAlreadyExists' };
    }
    if (code === 'weak_password' || lower.includes('password should') || lower.includes('weak password')) {
      return { code: 'weak_password', rawMessage, i18nKey: 'auth.errors.weakPassword' };
    }
    if (code === 'over_email_send_rate_limit' || lower.includes('rate') || lower.includes('too many')) {
      return { code: 'rate_limited', rawMessage, i18nKey: 'auth.errors.rateLimited' };
    }
    if (lower.includes('invalid') && (lower.includes('token') || lower.includes('link') || lower.includes('otp'))) {
      return { code: 'invalid_or_expired_link', rawMessage, i18nKey: 'auth.errors.invalidOrExpiredLink' };
    }
  }

  return { code: 'unknown', rawMessage, i18nKey: 'auth.errors.unknown' };
};
