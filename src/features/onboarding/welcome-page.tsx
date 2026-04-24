import { ArrowRight, KeyRound, Plus, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { ThemeToggle } from '@/components/common/theme-toggle';
import { Button } from '@/components/ui/button';
import { parseSignupIntent, type SignupIntent } from '@/features/auth/schemas';
import { useJoinByCodeMutation } from '@/features/concours/use-concours';
import { useAuth } from '@/hooks/use-auth';

import {
  useMarkWelcomedMutation,
  useOnboardingProgressQuery,
} from './use-onboarding';

/**
 * Page d'accueil post-signup (FTUE — First Time User Experience).
 *
 * Cette page est rendue hors de l'AppLayout (full-screen) pour créer
 * une respiration visuelle entre le signup et le dashboard, et donner
 * un moment émotionnel "bienvenue" avant de replonger dans l'app.
 *
 * Flow :
 *   1. Au mount : lit `onboarding:intent` + `onboarding:inviteCode`
 *      depuis sessionStorage (stockés par le signup wizard).
 *   2. Marque `welcomed_at` (idempotent côté SQL si déjà défini).
 *   3. Si un invite code est stocké : tente un auto-join immédiat.
 *      - Succès  → navigate vers `/app/concours/:id` + toast success.
 *      - Échec   → toast error + reste sur welcome + nettoie le code.
 *   4. Sans code : affiche 2 cartes CTA adaptées à l'intent
 *      (prioriser join vs create selon l'URL d'origine).
 *
 * Guard :
 *   - Si l'user a déjà `welcomed_at` non-null, redirige vers le
 *     dashboard (évite de ré-afficher la page à chaque login).
 */
export const WelcomePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const userId = user?.id;

  // Lecture session storage une seule fois au montage — pas de re-read
  const storedIntent = useMemo<SignupIntent | null>(() => {
    if (typeof window === 'undefined') return null;
    return parseSignupIntent(sessionStorage.getItem('onboarding:intent'));
  }, []);
  const storedInviteCode = useMemo<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const v = sessionStorage.getItem('onboarding:inviteCode');
    return v && v.trim().length > 0 ? v.trim() : null;
  }, []);

  const progressQuery = useOnboardingProgressQuery(userId);
  const markWelcomed = useMarkWelcomedMutation();
  const joinMutation = useJoinByCodeMutation(userId);

  // Guard contre les triggers multiples (StrictMode + remount dev)
  const welcomedTriggered = useRef(false);
  const joinTriggered = useRef(false);

  // Marque welcomed_at au premier montage
  useEffect(() => {
    if (!userId || welcomedTriggered.current) return;
    welcomedTriggered.current = true;
    markWelcomed.mutate(userId);
    // markWelcomed est stable (mutation ref), pas besoin en deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Auto-join si code stocké
  useEffect(() => {
    if (!userId || joinTriggered.current || !storedInviteCode) return;
    joinTriggered.current = true;

    joinMutation.mutate(storedInviteCode, {
      onSuccess: (concoursId) => {
        sessionStorage.removeItem('onboarding:inviteCode');
        sessionStorage.removeItem('onboarding:intent');
        toast.success(t('concours.toast.joinSuccess'));
        navigate(`/app/concours/${concoursId}`, { replace: true });
      },
      onError: (err) => {
        sessionStorage.removeItem('onboarding:inviteCode');
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('concours_not_found') || msg.includes('PGRST116')) {
          toast.error(t('concours.toast.joinNotFound'));
        } else if (msg.includes('concours_not_joinable')) {
          toast.error(t('concours.toast.joinNotJoinable'));
        } else {
          toast.error(t('concours.toast.joinError'));
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, storedInviteCode]);

  // Guard : redirect vers dashboard si déjà welcomé (évite d'être coincé
  // ici indéfiniment si un user revisite /app/welcome à la main)
  const alreadyWelcomed = Boolean(progressQuery.data?.welcomed_at);
  if (alreadyWelcomed && !storedInviteCode) {
    return <Navigate to="/app/dashboard" replace />;
  }

  const firstName =
    (user?.user_metadata?.prenom as string | undefined) ??
    user?.email?.split('@')[0] ??
    '';

  const isJoinIntent = storedIntent === 'join';

  return (
    <div className="flex min-h-screen flex-col">
      {/* Topbar minimaliste */}
      <header className="flex h-topbar items-center justify-between px-4 sm:px-6">
        <Link
          to="/app/dashboard"
          className="flex items-center gap-2 text-base font-semibold tracking-tight"
          aria-label={t('app.title')}
        >
          <span
            aria-hidden
            className="bg-brand-gradient flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-white shadow-primary"
          >
            P
          </span>
          <span className="hidden sm:inline">{t('app.title')}</span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/dashboard">
              {t('onboarding.welcome.skip')}
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero plein centré */}
      <main className="bg-brand-gradient-soft flex flex-1 items-center px-6 py-12">
        <div className="mx-auto w-full max-w-3xl text-center">
          <span className="eyebrow inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t('onboarding.welcome.eyebrow')}
          </span>

          <h1 className="display mt-6 animate-celebrate text-foreground">
            {firstName
              ? t('onboarding.welcome.titleNamed', { name: firstName })
              : t('onboarding.welcome.titleAnon')}
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            {joinMutation.isPending
              ? t('onboarding.welcome.joiningSubtitle')
              : t('onboarding.welcome.subtitle')}
          </p>

          {/* 2 cartes choix — masquées pendant l'auto-join */}
          {!joinMutation.isPending ? (
            <div className="mx-auto mt-10 grid max-w-2xl gap-4 sm:grid-cols-2">
              <ChoiceCard
                icon={KeyRound}
                title={t('onboarding.welcome.choiceJoin.title')}
                description={t('onboarding.welcome.choiceJoin.description')}
                cta={t('onboarding.welcome.choiceJoin.cta')}
                to="/app/concours"
                highlighted={isJoinIntent}
              />
              <ChoiceCard
                icon={Plus}
                title={t('onboarding.welcome.choiceCreate.title')}
                description={t('onboarding.welcome.choiceCreate.description')}
                cta={t('onboarding.welcome.choiceCreate.cta')}
                to="/app/concours/nouveau"
                highlighted={storedIntent === 'create'}
              />
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
};

// ------------------------------------------------------------------
//  ChoiceCard locale
// ------------------------------------------------------------------

interface ChoiceCardProps {
  icon: typeof KeyRound;
  title: string;
  description: string;
  cta: string;
  to: string;
  highlighted?: boolean;
}

function ChoiceCard({
  icon: Icon,
  title,
  description,
  cta,
  to,
  highlighted,
}: ChoiceCardProps) {
  return (
    <Link
      to={to}
      className={
        'group flex flex-col items-start gap-3 rounded-xl border bg-background p-6 text-left shadow-sm transition-all duration-base ' +
        (highlighted
          ? 'border-primary/50 shadow-primary'
          : 'border-border hover:border-primary/30 hover:shadow-md')
      }
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="h3 text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary">
        {cta}
        <ArrowRight className="h-4 w-4 transition-transform duration-base group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
