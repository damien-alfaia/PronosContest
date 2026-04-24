import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { signUpWithPassword } from '@/features/auth/api';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { type TypedAuthError } from '@/features/auth/errors';
import {
  parseSignupIntent,
  signupSchema,
  type SignupInput,
} from '@/features/auth/schemas';

/**
 * Signup classique — 4 champs en une seule étape (email, password,
 * prenom, nom). Pas de wizard, pas de step indicator.
 *
 * Intent URL (`?intent=join|create`) :
 *   La landing pousse l'un ou l'autre CTA vers `/auth/signup` avec une
 *   intent en query. On la stocke en sessionStorage pour que la page
 *   `/app/welcome` (post-signup) puisse mettre en avant la bonne carte.
 *   La saisie du code d'invitation se fait depuis le welcome / la
 *   liste des concours, pas ici (décision UX : garder le signup
 *   minimal pour ne pas bloquer la conversion).
 *
 * Post-signup :
 *   - Session créée immédiatement (enable_confirmations = false en dev) →
 *     redirige vers `/app/welcome` (entry point FTUE).
 *   - Email confirmation nécessaire → toast + `/auth/login`.
 */
export const SignupPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const intent = useMemo(
    () => parseSignupIntent(searchParams.get('intent')),
    [searchParams],
  );

  // Stocke l'intent en session pour que /app/welcome puisse s'y référer.
  useEffect(() => {
    if (intent) {
      sessionStorage.setItem('onboarding:intent', intent);
    } else {
      sessionStorage.removeItem('onboarding:intent');
    }
  }, [intent]);

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', prenom: '', nom: '' },
  });

  const mutation = useMutation<unknown, TypedAuthError, SignupInput>({
    mutationFn: signUpWithPassword,
    onSuccess: (data) => {
      const hasSession =
        typeof data === 'object' &&
        data !== null &&
        'session' in data &&
        (data as { session: unknown }).session !== null;

      if (hasSession) {
        // Entry point FTUE (Sprint 9.B) : petite respiration avant
        // le dashboard, avec choix "rejoindre" vs "créer".
        navigate('/app/welcome', { replace: true });
      } else {
        toast.success(t('auth.signup.emailSent'));
        navigate('/auth/login', { replace: true });
      }
    },
    onError: (err) => {
      toast.error(t(err.i18nKey));
    },
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  const err = (field: keyof SignupInput) => {
    const msg = form.formState.errors[field]?.message;
    return msg ? t(msg) : null;
  };

  return (
    <AuthLayout
      title={t('auth.signup.title')}
      subtitle={t('auth.signup.subtitle')}
      footer={
        <p>
          {t('auth.signup.alreadyAccount')}{' '}
          <Link
            to="/auth/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t('auth.signup.loginLink')}
          </Link>
        </p>
      }
    >
      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="prenom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('auth.fields.prenom')}</FormLabel>
                  <FormControl>
                    <Input autoComplete="given-name" {...field} />
                  </FormControl>
                  <FormMessage>{err('prenom')}</FormMessage>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('auth.fields.nom')}</FormLabel>
                  <FormControl>
                    <Input autoComplete="family-name" {...field} />
                  </FormControl>
                  <FormMessage>{err('nom')}</FormMessage>
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.fields.email')}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder={t('auth.fields.emailPlaceholder')}
                    {...field}
                  />
                </FormControl>
                <FormMessage>{err('email')}</FormMessage>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.fields.password')}</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder={t('auth.fields.passwordPlaceholder')}
                    {...field}
                  />
                </FormControl>
                <FormMessage>{err('password')}</FormMessage>
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('common.submitting')}
              </>
            ) : (
              t('auth.signup.submit')
            )}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
};
