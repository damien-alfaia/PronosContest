import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
  signupWizardSchema,
  type SignupIntent,
  type SignupWizardInput,
} from '@/features/auth/schemas';
import { cn } from '@/lib/utils';

/**
 * Signup wizard — Sprint 9.B.2.
 *
 * 3 étapes minimalistes pour ne pas casser la conversion :
 *   1. Email + mot de passe (décision "j'ai un compte" facile)
 *   2. Prénom + nom (humaniser le classement)
 *   3. Code d'invitation — optionnel (consommé post-signup par /app/welcome)
 *
 * Intent URL (`?intent=join|create`) :
 *   - `join`   : l'utilisateur vient du CTA "J'ai un code d'invitation" ;
 *     l'étape 3 met le focus sur le champ code et le marque comme
 *     suggestion forte. Intent stockée en session pour post-signup.
 *   - `create` : l'utilisateur vient du CTA "Créer un concours" ; on
 *     garde les 3 étapes (le code reste optionnel pour ne pas forcer),
 *     puis `/app/welcome` oriente vers la création.
 *   - `null`   : parcours neutre, identique à `create` sans signal post.
 *
 * Stockage session (consommé par `/app/welcome`) :
 *   - `onboarding:intent`     → `'join' | 'create' | null`
 *   - `onboarding:inviteCode` → string si non vide
 *
 * Post-signup :
 *   - Session créée (enable_confirmations = false) → `/app/welcome`.
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

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const form = useForm<SignupWizardInput>({
    resolver: zodResolver(signupWizardSchema),
    defaultValues: {
      email: '',
      password: '',
      prenom: '',
      nom: '',
      inviteCode: '',
    },
    mode: 'onBlur',
  });

  // ----- Capture de l'intent : stockage session dès l'arrivée -----
  // On stocke tôt pour que même un rebound (reload, email confirm) ne
  // perde pas l'info. Recomputé si l'URL change.
  useEffect(() => {
    if (intent) {
      sessionStorage.setItem('onboarding:intent', intent);
    } else {
      sessionStorage.removeItem('onboarding:intent');
    }
  }, [intent]);

  const mutation = useMutation<unknown, TypedAuthError, SignupWizardInput>({
    mutationFn: ({ email, password, prenom, nom }) =>
      signUpWithPassword({ email, password, prenom, nom }),
    onSuccess: (data, variables) => {
      // Stocke le code d'invitation pour consommation post-signup par
      // /app/welcome (evite une query param exposée + persiste au reload).
      const code = variables.inviteCode?.trim();
      if (code) {
        sessionStorage.setItem('onboarding:inviteCode', code);
      } else {
        sessionStorage.removeItem('onboarding:inviteCode');
      }

      const hasSession =
        typeof data === 'object' &&
        data !== null &&
        'session' in data &&
        (data as { session: unknown }).session !== null;

      if (hasSession) {
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

  // ----- Avance : valide les champs de l'étape courante avant de passer -----
  const next = async () => {
    const fieldsByStep: Record<1 | 2, (keyof SignupWizardInput)[]> = {
      1: ['email', 'password'],
      2: ['prenom', 'nom'],
    };
    const currentFields = fieldsByStep[step as 1 | 2];
    const valid = await form.trigger(currentFields, { shouldFocus: true });
    if (valid) setStep((s) => ((s + 1) as 1 | 2 | 3));
  };

  const back = () => setStep((s) => (Math.max(1, s - 1) as 1 | 2 | 3));

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  const err = (field: keyof SignupWizardInput) => {
    const msg = form.formState.errors[field]?.message;
    return msg ? t(msg) : null;
  };

  return (
    <AuthLayout
      title={t('auth.signup.title')}
      subtitle={t(`auth.signup.wizard.step${step}.subtitle`)}
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
      <StepIndicator current={step} total={3} labels={getStepLabels(t)} />

      <Form {...form}>
        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          {step === 1 ? (
            <Step1 form={form} err={err} t={t} />
          ) : step === 2 ? (
            <Step2 form={form} err={err} t={t} />
          ) : (
            <Step3 form={form} err={err} t={t} intent={intent} />
          )}

          <div className="flex items-center gap-2 pt-2">
            {step > 1 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={back}
                disabled={mutation.isPending}
              >
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
                {t('common.back')}
              </Button>
            ) : null}

            {step < 3 ? (
              <Button
                type="button"
                className="ml-auto"
                onClick={() => {
                  void next();
                }}
              >
                {t('auth.signup.wizard.nextStep')}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            ) : (
              <Button
                type="submit"
                className="ml-auto"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('common.submitting')}
                  </>
                ) : (
                  t('auth.signup.submit')
                )}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </AuthLayout>
  );
};

// ------------------------------------------------------------------
//  Sous-composants locaux
// ------------------------------------------------------------------

type TFn = (key: string, options?: Record<string, unknown>) => string;

function getStepLabels(t: TFn): string[] {
  return [
    t('auth.signup.wizard.step1.label'),
    t('auth.signup.wizard.step2.label'),
    t('auth.signup.wizard.step3.label'),
  ];
}

interface StepIndicatorProps {
  current: number;
  total: number;
  labels: string[];
}

function StepIndicator({ current, total, labels }: StepIndicatorProps) {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t('auth.signup.wizard.stepAriaLabel')}
      className="flex items-center justify-center gap-2"
    >
      {Array.from({ length: total }).map((_, i) => {
        const step = i + 1;
        const active = step === current;
        const done = step < current;
        return (
          <div
            key={step}
            aria-current={active ? 'step' : undefined}
            className="flex items-center gap-2"
          >
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums',
                active &&
                  'border-primary bg-primary text-primary-foreground shadow-primary',
                done && 'border-primary/30 bg-primary/10 text-primary',
                !active &&
                  !done &&
                  'border-border bg-background text-muted-foreground',
              )}
            >
              {step}
            </span>
            {active ? (
              <span className="hidden text-xs font-medium text-foreground sm:inline">
                {labels[i]}
              </span>
            ) : null}
            {step < total ? (
              <span
                aria-hidden
                className={cn(
                  'h-px w-4 sm:w-8',
                  done ? 'bg-primary/40' : 'bg-border',
                )}
              />
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

interface StepProps {
  form: ReturnType<typeof useForm<SignupWizardInput>>;
  err: (field: keyof SignupWizardInput) => string | null;
  t: TFn;
}

function Step1({ form, err, t }: StepProps) {
  return (
    <>
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
                autoFocus
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
    </>
  );
}

function Step2({ form, err, t }: StepProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <FormField
        control={form.control}
        name="prenom"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('auth.fields.prenom')}</FormLabel>
            <FormControl>
              <Input autoComplete="given-name" autoFocus {...field} />
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
  );
}

interface Step3Props extends StepProps {
  intent: SignupIntent | null;
}

function Step3({ form, err, t, intent }: Step3Props) {
  const isJoinIntent = intent === 'join';
  return (
    <div className="space-y-3">
      {/* Hint visuel adapté à l'intent */}
      <div
        className={cn(
          'flex items-start gap-3 rounded-lg border p-3 text-sm',
          isJoinIntent
            ? 'border-primary/30 bg-primary/5'
            : 'border-border bg-secondary/30',
        )}
      >
        <Sparkles
          className="mt-0.5 h-4 w-4 shrink-0 text-primary"
          aria-hidden
        />
        <div>
          <p className="font-medium text-foreground">
            {isJoinIntent
              ? t('auth.signup.wizard.step3.hintJoin')
              : t('auth.signup.wizard.step3.hintNeutral')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('auth.signup.wizard.step3.hintOptional')}
          </p>
        </div>
      </div>

      <FormField
        control={form.control}
        name="inviteCode"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('auth.signup.wizard.step3.inputLabel')}</FormLabel>
            <FormControl>
              <Input
                autoComplete="off"
                autoFocus={isJoinIntent}
                autoCapitalize="characters"
                placeholder={t('auth.signup.wizard.step3.placeholder')}
                {...field}
              />
            </FormControl>
            <FormMessage>{err('inviteCode')}</FormMessage>
          </FormItem>
        )}
      />
    </div>
  );
}
