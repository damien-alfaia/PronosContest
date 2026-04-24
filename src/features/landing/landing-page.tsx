import {
  ArrowRight,
  Bell,
  ChevronDown,
  ClipboardCheck,
  Flame,
  KeyRound,
  Medal,
  MessageSquareText,
  Plus,
  Smartphone,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { ThemeToggle } from '@/components/common/theme-toggle';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

import { SocialProofStrip } from './social-proof-strip';

/**
 * Landing page — refonte Sprint 9 (Semaine 1).
 *
 * Sections dans l'ordre :
 *   1. Topbar   (logo + login + thème + langue)
 *   2. Hero     (headline + 2 CTAs + mockup SVG)
 *   3. Social proof  (chiffres agrégés via RPC get_landing_stats)
 *   4. Comment ça marche  (3 étapes)
 *   5. Features  (6 cards)
 *   6. Bloc "100 % gratuit"  (bandeau contrasté + CTA final)
 *   7. FAQ  (5 questions, accordéon natif <details>)
 *   8. Footer
 *
 * Accessibilité :
 *   - landmarks HTML : <header>, <main>, <footer>, <section aria-labelledby>
 *   - headings hiérarchisés (h1 hero, h2 sections, h3 cards)
 *   - FAQ en <details>/<summary> : keyboard + screen reader natifs
 *   - contraste vérifié (foreground AA sur bg-brand-gradient-soft)
 *   - animation d'entrée désactivée si prefers-reduced-motion
 *
 * Perf :
 *   - zéro dépendance lourde ajoutée
 *   - SocialProofStrip échoue silencieusement (pas de blocage landing)
 *   - Icônes importées individuellement (tree-shaking lucide-react OK)
 */
export function LandingPage() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated } = useAuth();

  const toggleLocale = () => {
    void i18n.changeLanguage(i18n.language.startsWith('fr') ? 'en' : 'fr');
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* ============================================================
       *  Topbar
       * ============================================================ */}
      <header className="sticky top-0 z-20 flex h-topbar items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur-md sm:px-6">
        <Link
          to="/"
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

        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLocale}
            aria-label={t('locale.toggle')}
          >
            {i18n.language.toUpperCase().slice(0, 2)}
          </Button>
          <ThemeToggle />
          {isAuthenticated ? (
            <Button asChild size="sm">
              <Link to="/app/dashboard">
                {t('landing.topbar.goToApp')}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex"
              >
                <Link to="/auth/login">{t('landing.topbar.login')}</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/auth/signup">
                  <span className="hidden sm:inline">
                    {t('landing.topbar.signupShort')}
                  </span>
                  <span className="sm:hidden">
                    {t('landing.topbar.signupShort')}
                  </span>
                </Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* ==========================================================
         *  Hero
         * ========================================================== */}
        <section
          className="bg-brand-gradient-soft relative overflow-hidden"
          aria-labelledby="landing-hero-heading"
        >
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-2 md:items-center md:gap-8 md:py-24">
            <div className="animate-celebrate flex flex-col items-start gap-6">
              <span className="eyebrow inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {t('landing.hero.eyebrow')}
              </span>

              <h1
                id="landing-hero-heading"
                className="display text-left text-foreground"
              >
                {t('landing.hero.title')}
              </h1>

              <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
                {t('landing.hero.subtitle')}
              </p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild size="lg">
                  <Link to="/auth/signup?intent=join">
                    <KeyRound className="mr-2 h-4 w-4" aria-hidden />
                    {t('landing.hero.ctaJoin')}
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/auth/signup?intent=create">
                    <Plus className="mr-2 h-4 w-4" aria-hidden />
                    {t('landing.hero.ctaCreate')}
                  </Link>
                </Button>
              </div>
            </div>

            <HeroMockup />
          </div>
        </section>

        {/* ==========================================================
         *  Social proof
         * ========================================================== */}
        <section
          aria-label={t('landing.socialProof.ariaLabel')}
          className="border-b border-border/60 bg-background/60 py-8"
        >
          <SocialProofStrip className="mx-auto max-w-5xl px-6" />
        </section>

        {/* ==========================================================
         *  Comment ça marche
         * ========================================================== */}
        <section
          aria-labelledby="landing-how-heading"
          className="mx-auto w-full max-w-6xl px-6 py-20"
        >
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="landing-how-heading" className="h1">
              {t('landing.howItWorks.title')}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t('landing.howItWorks.subtitle')}
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <HowItWorksStep
              icon={KeyRound}
              title={t('landing.howItWorks.steps.join.title')}
              description={t('landing.howItWorks.steps.join.description')}
            />
            <HowItWorksStep
              icon={Target}
              title={t('landing.howItWorks.steps.predict.title')}
              description={t('landing.howItWorks.steps.predict.description')}
            />
            <HowItWorksStep
              icon={Medal}
              title={t('landing.howItWorks.steps.rank.title')}
              description={t('landing.howItWorks.steps.rank.description')}
            />
          </div>
        </section>

        {/* ==========================================================
         *  Features
         * ========================================================== */}
        <section
          aria-labelledby="landing-features-heading"
          className="border-y border-border/60 bg-secondary/30 py-20"
        >
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 id="landing-features-heading" className="h1">
                {t('landing.features.title')}
              </h2>
              <p className="mt-3 text-muted-foreground">
                {t('landing.features.subtitle')}
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon={Flame}
                title={t('landing.features.cards.scoring.title')}
                description={t('landing.features.cards.scoring.description')}
              />
              <FeatureCard
                icon={Zap}
                title={t('landing.features.cards.jokers.title')}
                description={t('landing.features.cards.jokers.description')}
              />
              <FeatureCard
                icon={Medal}
                title={t('landing.features.cards.badges.title')}
                description={t('landing.features.cards.badges.description')}
              />
              <FeatureCard
                icon={MessageSquareText}
                title={t('landing.features.cards.chat.title')}
                description={t('landing.features.cards.chat.description')}
              />
              <FeatureCard
                icon={Bell}
                title={t('landing.features.cards.realtime.title')}
                description={t('landing.features.cards.realtime.description')}
              />
              <FeatureCard
                icon={Smartphone}
                title={t('landing.features.cards.offline.title')}
                description={t('landing.features.cards.offline.description')}
              />
            </div>
          </div>
        </section>

        {/* ==========================================================
         *  Bloc 100 % gratuit
         * ========================================================== */}
        <section
          aria-labelledby="landing-free-heading"
          className="mx-auto w-full max-w-6xl px-6 py-20"
        >
          <div className="bg-brand-gradient relative overflow-hidden rounded-2xl px-8 py-12 text-center text-white shadow-primary sm:px-16 sm:py-16">
            <span className="eyebrow inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-white/90">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {t('landing.free.eyebrow')}
            </span>
            <h2 id="landing-free-heading" className="display mt-4 text-white">
              {t('landing.free.title')}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-white/90">
              {t('landing.free.description')}
            </p>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="mt-8 shadow-lg"
            >
              <Link to="/auth/signup">
                {t('landing.free.cta')}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </section>

        {/* ==========================================================
         *  FAQ
         * ========================================================== */}
        <section
          aria-labelledby="landing-faq-heading"
          className="border-t border-border/60 bg-background py-20"
        >
          <div className="mx-auto w-full max-w-3xl px-6">
            <h2 id="landing-faq-heading" className="h1 text-center">
              {t('landing.faq.title')}
            </h2>

            <div className="mt-10 flex flex-col gap-3">
              <FaqItem
                question={t('landing.faq.items.free.question')}
                answer={t('landing.faq.items.free.answer')}
              />
              <FaqItem
                question={t('landing.faq.items.howToCreate.question')}
                answer={t('landing.faq.items.howToCreate.answer')}
              />
              <FaqItem
                question={t('landing.faq.items.rugby.question')}
                answer={t('landing.faq.items.rugby.answer')}
              />
              <FaqItem
                question={t('landing.faq.items.limited.question')}
                answer={t('landing.faq.items.limited.answer')}
              />
              <FaqItem
                question={t('landing.faq.items.data.question')}
                answer={t('landing.faq.items.data.answer')}
              />
            </div>
          </div>
        </section>
      </main>

      {/* ============================================================
       *  Footer
       * ============================================================ */}
      <footer className="border-t border-border/60 bg-background/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-10 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <p>{t('landing.footer.madeWith')}</p>
            <p className="text-xs">{t('landing.footer.copyright')}</p>
          </div>
          <nav
            aria-label={t('landing.footer.links.terms')}
            className="flex flex-wrap gap-x-6 gap-y-2"
          >
            <Link
              to="/legal/terms"
              className="transition-colors hover:text-foreground"
            >
              {t('landing.footer.links.terms')}
            </Link>
            <Link
              to="/legal/privacy"
              className="transition-colors hover:text-foreground"
            >
              {t('landing.footer.links.privacy')}
            </Link>
            <Link
              to="/contact"
              className="transition-colors hover:text-foreground"
            >
              {t('landing.footer.links.contact')}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
//  Sous-composants locaux
// ============================================================

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

interface HowItWorksStepProps {
  icon: IconType;
  title: string;
  description: string;
}

function HowItWorksStep({
  icon: Icon,
  title,
  description,
}: HowItWorksStepProps) {
  return (
    <article className="flex flex-col items-start gap-3 rounded-xl border border-border/60 bg-background p-6 shadow-sm">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="h3">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </article>
  );
}

interface FeatureCardProps {
  icon: IconType;
  title: string;
  description: string;
}

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <article className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background p-5 shadow-sm transition-shadow duration-base hover:shadow-md">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/10 text-accent">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </article>
  );
}

interface FaqItemProps {
  question: string;
  answer: ReactNode;
}

/**
 * FaqItem — accordéon natif via <details>/<summary>.
 *
 * Avantages par rapport à un composant custom :
 *   - Keyboard (Enter/Space) et screen reader natifs
 *   - Aucun JS de state nécessaire
 *   - Fonctionne même avant hydratation côté client
 *   - Pas de dépendance @radix-ui/react-accordion à ajouter
 *
 * Le chevron utilise le selector `details[open]` pour rotate.
 */
function FaqItem({ question, answer }: FaqItemProps) {
  return (
    <details className="group rounded-xl border border-border/60 bg-background px-5 py-4 shadow-sm open:shadow-md">
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium outline-none',
          'focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
      >
        <span>{question}</span>
        <ChevronDown
          className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-base group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <p className="mt-3 text-sm text-muted-foreground">{answer}</p>
    </details>
  );
}

/**
 * HeroMockup — illustration SVG inline d'un classement live.
 *
 * Simule une carte de scoreboard avec 3 joueurs, dont "Moi" en tête,
 * et un match en bas (FR vs BR · groupe D). Objectif : donner un
 * avant-goût concret de l'app sans charger une capture d'écran.
 *
 * Design : card blanche (ou card-foreground en dark) avec shadow-lg,
 * slight rotation pour dynamiser. Animate-celebrate sur le conteneur.
 */
function HeroMockup() {
  const { t } = useTranslation();

  return (
    <div
      role="img"
      aria-label={t('landing.hero.mockupAlt')}
      className="animate-celebrate relative mx-auto w-full max-w-md"
    >
      <div className="relative rotate-1 rounded-2xl border border-border bg-card p-5 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="eyebrow">
            {t('landing.hero.mockupScoreboardTitle')}
          </span>
          <Medal className="h-4 w-4 text-accent" aria-hidden />
        </div>

        {/* 3 rows */}
        <div className="mt-4 flex flex-col gap-2">
          <ScoreboardRow
            rank={1}
            name={t('landing.hero.mockupScoreboardPlayer3')}
            points={142}
            highlighted
          />
          <ScoreboardRow
            rank={2}
            name={t('landing.hero.mockupScoreboardPlayer1')}
            points={128}
          />
          <ScoreboardRow
            rank={3}
            name={t('landing.hero.mockupScoreboardPlayer2')}
            points={115}
          />
        </div>

        {/* Divider */}
        <div className="my-4 h-px bg-border" />

        {/* Match prediction */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t('landing.hero.mockupMatchLabel')}
          </span>
          <div className="flex items-center gap-2">
            <span className="score" style={{ fontSize: '1.25rem' }}>
              2
            </span>
            <span className="text-muted-foreground">–</span>
            <span className="score" style={{ fontSize: '1.25rem' }}>
              1
            </span>
            <ClipboardCheck className="h-4 w-4 text-success" aria-hidden />
          </div>
        </div>
      </div>

      {/* Floating badge accent */}
      <span
        aria-hidden
        className="absolute -right-3 -top-3 flex h-12 w-12 rotate-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-accent"
      >
        <Sparkles className="h-5 w-5" />
      </span>
    </div>
  );
}

interface ScoreboardRowProps {
  rank: number;
  name: string;
  points: number;
  highlighted?: boolean;
}

function ScoreboardRow({
  rank,
  name,
  points,
  highlighted,
}: ScoreboardRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-md px-3 py-2 text-sm',
        highlighted && 'bg-primary/10',
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
            rank === 1 && 'bg-podium-gold text-amber-900',
            rank === 2 && 'bg-podium-silver text-slate-900',
            rank === 3 && 'bg-podium-bronze text-amber-50',
          )}
        >
          {rank}
        </span>
        <span className={cn('font-medium', highlighted && 'text-primary')}>
          {name}
        </span>
      </div>
      <span className="font-semibold tabular-nums">{points}</span>
    </div>
  );
}
