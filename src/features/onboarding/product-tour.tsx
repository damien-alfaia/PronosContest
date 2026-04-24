import { ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

import { TOUR_STEP_IDS, type TourStepId } from './schemas';
import {
  useMarkTourStepCompletedMutation,
  useOnboardingProgressQuery,
  useSkipTourMutation,
} from './use-onboarding';

/**
 * ProductTour — visite guidée en 3 étapes sur la grille des pronos.
 *
 * Chaque étape cible un élément via `data-tour` (ex: `data-tour="pronos-filters"`)
 * et affiche un popover contextualisé à côté. Un overlay semi-transparent
 * assombrit le reste de l'écran, l'élément ciblé est mis en avant via
 * un anneau `ring-primary` animé (ajouté en data-attr, le CSS gère).
 *
 * Cycle de vie :
 *   - Auto-start au montage si `tour_steps_completed` est vide (user
 *     n'a jamais vu le tour) ET que les éléments ciblés sont dans le DOM.
 *   - À chaque Next, `markTourStepCompleted` est appelé pour l'étape.
 *   - Skip global : `skipTour` marque toutes les étapes d'un coup.
 *   - Fermé une fois toutes les étapes marquées.
 *
 * Accessibilité :
 *   - popover `role="dialog"` + `aria-labelledby` sur le titre.
 *   - overlay `aria-hidden` (décoratif).
 *   - focus trappé dans le popover via `autoFocus` sur le CTA principal.
 *   - `Esc` ferme le tour (= skip all).
 */

type TourStep = {
  id: TourStepId;
  target: string; // selector via data-tour="..."
  titleKey: string;
  descriptionKey: string;
  placement?: 'top' | 'bottom';
};

const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'pronos.first_match_card',
    target: 'pronos-first-match-card',
    titleKey: 'onboarding.tour.steps.pronosFirstMatchCard.title',
    descriptionKey: 'onboarding.tour.steps.pronosFirstMatchCard.description',
    placement: 'bottom',
  },
  {
    id: 'pronos.filters',
    target: 'pronos-filters',
    titleKey: 'onboarding.tour.steps.pronosFilters.title',
    descriptionKey: 'onboarding.tour.steps.pronosFilters.description',
    placement: 'bottom',
  },
  {
    id: 'pronos.classement_cta',
    target: 'pronos-classement-cta',
    titleKey: 'onboarding.tour.steps.pronosClassementCta.title',
    descriptionKey: 'onboarding.tour.steps.pronosClassementCta.description',
    placement: 'top',
  },
] as const;

// Retour à la ligne inutile ici mais TS aime bien ce pattern
if (TOUR_STEPS.length !== TOUR_STEP_IDS.length) {
  // Garde de cohérence : TOUR_STEPS (UI) doit matcher TOUR_STEP_IDS (schema)
  throw new Error('TOUR_STEPS / TOUR_STEP_IDS mismatch');
}

interface ProductTourProps {
  /**
   * Laisse-passer : si false, le composant ne rend rien du tout.
   * Utile pour désactiver le tour en test ou sur un device qui n'a
   * pas les éléments ciblés (ex: page vide).
   */
  enabled?: boolean;
}

export function ProductTour({ enabled = true }: ProductTourProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id;

  const progressQuery = useOnboardingProgressQuery(userId);
  const markStep = useMarkTourStepCompletedMutation();
  const skipAll = useSkipTourMutation();

  // Filtre les étapes déjà complétées
  const pendingSteps = useMemo(() => {
    const completed = new Set<string>(
      progressQuery.data?.tour_steps_completed ?? [],
    );
    return TOUR_STEPS.filter((s) => !completed.has(s.id));
  }, [progressQuery.data]);

  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = pendingSteps[stepIndex] ?? null;

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const targetEl = useTargetElement(currentStep?.target);

  // Mesure la position du target (layout effect pour éviter 1 frame de flash)
  useLayoutEffect(() => {
    if (!targetEl) {
      setTargetRect(null);
      return;
    }
    const update = () => {
      setTargetRect(targetEl.getBoundingClientRect());
    };
    update();
    // On observe les resize + scroll pour recalculer la position
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('scroll', update, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, { capture: true });
    };
  }, [targetEl]);

  // Scroll le target dans le viewport au changement d'étape
  useEffect(() => {
    if (!targetEl) return;
    targetEl.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    });
  }, [targetEl]);

  // Esc = skip global
  const handleSkip = useCallback(() => {
    if (!userId) return;
    skipAll.mutate(userId);
  }, [userId, skipAll]);

  useEffect(() => {
    if (!currentStep) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentStep, handleSkip]);

  // Guards finaux
  if (!enabled || !userId) return null;
  if (progressQuery.isLoading) return null;
  if (!currentStep) return null;

  const handleNext = () => {
    if (!userId) return;
    markStep.mutate({ userId, stepId: currentStep.id });
    setStepIndex((i) => i + 1);
  };

  const isLast = stepIndex === pendingSteps.length - 1;

  return (
    <>
      {/* Overlay dimmed + ring sur le target */}
      <div
        aria-hidden
        className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
      />
      {targetRect ? <TargetRing rect={targetRect} /> : null}

      <TourPopover
        rect={targetRect}
        placement={currentStep.placement ?? 'bottom'}
        title={t(currentStep.titleKey)}
        description={t(currentStep.descriptionKey)}
        counter={t('onboarding.tour.stepCounter', {
          current: stepIndex + 1,
          total: pendingSteps.length,
        })}
        onNext={handleNext}
        onSkip={handleSkip}
        nextLabel={
          isLast ? t('onboarding.tour.done') : t('onboarding.tour.next')
        }
        skipLabel={t('onboarding.tour.skipAll')}
      />
    </>
  );
}

// ------------------------------------------------------------------
//  Hook interne : résout un data-tour selector en HTMLElement, avec
//  un retry si l'élément n'est pas encore monté.
// ------------------------------------------------------------------

function useTargetElement(key: string | undefined): HTMLElement | null {
  const [el, setEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!key) {
      setEl(null);
      return;
    }
    const selector = `[data-tour="${key}"]`;
    const found = document.querySelector<HTMLElement>(selector);
    if (found) {
      setEl(found);
      return;
    }
    // Retry léger en cas de montage asynchrone (lazy-loaded page)
    const timer = window.setInterval(() => {
      const retry = document.querySelector<HTMLElement>(selector);
      if (retry) {
        setEl(retry);
        window.clearInterval(timer);
      }
    }, 120);
    // Abandon après 2 secondes pour ne pas pomper le main thread
    const stop = window.setTimeout(() => window.clearInterval(timer), 2000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [key]);

  return el;
}

// ------------------------------------------------------------------
//  TargetRing — anneau visuel + coupure de l'overlay autour du target
// ------------------------------------------------------------------

function TargetRing({ rect }: { rect: DOMRect }) {
  const PAD = 8;
  const style = {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-40 rounded-lg ring-4 ring-primary ring-offset-2 ring-offset-background animate-pulse"
      style={style}
    />
  );
}

// ------------------------------------------------------------------
//  TourPopover — popover positionné au-dessus ou en dessous du target
// ------------------------------------------------------------------

interface TourPopoverProps {
  rect: DOMRect | null;
  placement: 'top' | 'bottom';
  title: string;
  description: string;
  counter: string;
  onNext: () => void;
  onSkip: () => void;
  nextLabel: string;
  skipLabel: string;
}

function TourPopover(props: TourPopoverProps) {
  const {
    rect,
    placement,
    title,
    description,
    counter,
    onNext,
    onSkip,
    nextLabel,
    skipLabel,
  } = props;

  // Position de repli si rect manquant : centré
  const style = useMemo(() => {
    if (!rect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      } as const;
    }
    const GAP = 18;
    const top =
      placement === 'top'
        ? rect.top - GAP
        : rect.bottom + GAP;
    return {
      top,
      left: rect.left + rect.width / 2,
      transform:
        placement === 'top'
          ? 'translate(-50%, -100%)'
          : 'translate(-50%, 0)',
    } as const;
  }, [rect, placement]);

  return (
    <div
      role="dialog"
      aria-labelledby="product-tour-title"
      aria-modal="false"
      className={cn(
        'fixed z-50 w-[min(320px,calc(100vw-32px))] rounded-xl border border-border bg-background p-4 shadow-lg',
      )}
      style={style}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="eyebrow text-primary">{counter}</span>
          <h2
            id="product-tour-title"
            className="text-sm font-semibold text-foreground"
          >
            {title}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onSkip}
          aria-label={skipLabel}
          className="h-6 w-6 shrink-0"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      <div className="mt-4 flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
          {skipLabel}
        </Button>
        <Button type="button" size="sm" onClick={onNext} autoFocus>
          {nextLabel}
          <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
