import type { MatchPhase } from '@/features/pronos/schemas';

/**
 * Mapping static des phases de compétition vers une rampe de couleurs
 * (du "froid/calme" en début de tournoi, vers le "chaud/trophée" en finale).
 *
 * Classes écrites en dur pour que Tailwind les voie.
 */

export type PhaseColor = {
  /** Classes pour un `<Badge />` (fond pâle / texte foncé, inversé en dark). */
  badge: string;
  /** Classe `border-l-<color>-500` pour le liseré d'une Card. */
  border: string;
};

const PHASE_COLORS: Record<MatchPhase, PhaseColor> = {
  groupes: {
    badge: 'border-transparent bg-muted text-muted-foreground',
    border: 'border-l-border',
  },
  seiziemes: {
    badge:
      'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200',
    border: 'border-l-sky-500',
  },
  huitiemes: {
    badge:
      'border-transparent bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-200',
    border: 'border-l-teal-500',
  },
  quarts: {
    badge:
      'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
    border: 'border-l-amber-500',
  },
  demis: {
    badge:
      'border-transparent bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-200',
    border: 'border-l-orange-500',
  },
  petite_finale: {
    badge:
      'border-transparent bg-slate-100 text-slate-800 dark:bg-slate-900/60 dark:text-slate-200',
    border: 'border-l-slate-400',
  },
  finale: {
    badge:
      'border-transparent bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100',
    border: 'border-l-amber-600',
  },
};

export const getPhaseColor = (phase: MatchPhase): PhaseColor => PHASE_COLORS[phase];
