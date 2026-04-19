import { z } from 'zod';

/**
 * Schémas Zod centralisés pour l'auth.
 *
 * Les messages sont des **clés i18n** (résolues par react-i18next via
 * `<FormMessage>` qui passe `t(field.error?.message ?? '')`).
 */

const emailSchema = z
  .string()
  .trim()
  .min(1, { message: 'auth.errors.invalidEmail' })
  .email({ message: 'auth.errors.invalidEmail' });

const passwordSchema = z
  .string()
  .min(8, { message: 'auth.errors.passwordTooShort' })
  .max(72, { message: 'auth.errors.passwordTooLong' });

const nameSchema = (key: 'firstNameRequired' | 'lastNameRequired') =>
  z
    .string()
    .trim()
    .min(1, { message: `auth.errors.${key}` })
    .max(50);

// ------- Login (email/password) -------
export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

// ------- Signup -------
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  prenom: nameSchema('firstNameRequired'),
  nom: nameSchema('lastNameRequired'),
});
export type SignupInput = z.infer<typeof signupSchema>;

// ------- Magic link -------
export const magicLinkSchema = z.object({
  email: emailSchema,
});
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;

// ------- Forgot password -------
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// ------- Reset password (après clic sur le lien email) -------
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'auth.errors.passwordsDontMatch',
    path: ['confirmPassword'],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
