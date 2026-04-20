/**
 * Mapping static des groupes A..L (FIFA WC 2026 — 12 groupes) vers une
 * teinte Tailwind. Les classes sont écrites en dur (pas d'interpolation)
 * pour que le scanner de purge de Tailwind les voie.
 *
 * Chaque groupe reçoit :
 *  - `badge`   : classes pour un `<Badge />` coloré (fond pâle / texte foncé,
 *                inversé en dark mode)
 *  - `border`  : classe `border-l-<color>-500` pour le liseré d'une Card
 *  - `dot`     : classe `bg-<color>-500` (petite pastille)
 *  - `tint`    : classe `bg-<color>-50/60` (fond très doux pour un pseudo-header)
 */

export type GroupLetter =
  | 'a' | 'b' | 'c' | 'd'
  | 'e' | 'f' | 'g' | 'h'
  | 'i' | 'j' | 'k' | 'l';

export type GroupColor = {
  /** Classes badge : fond + texte + borders (pour rester cohérent avec `Badge`). */
  badge: string;
  /** Classe de bordure gauche pour une Card (liseré 4px). */
  border: string;
  /** Classe petite pastille (pour un indicateur rond). */
  dot: string;
  /** Fond très doux (pseudo-header de section). */
  tint: string;
};

const GROUP_COLORS: Record<GroupLetter, GroupColor> = {
  a: {
    badge:
      'border-transparent bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200',
    border: 'border-l-red-500',
    dot: 'bg-red-500',
    tint: 'bg-red-50/60 dark:bg-red-950/20',
  },
  b: {
    badge:
      'border-transparent bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-200',
    border: 'border-l-orange-500',
    dot: 'bg-orange-500',
    tint: 'bg-orange-50/60 dark:bg-orange-950/20',
  },
  c: {
    badge:
      'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
    border: 'border-l-amber-500',
    dot: 'bg-amber-500',
    tint: 'bg-amber-50/60 dark:bg-amber-950/20',
  },
  d: {
    badge:
      'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-200',
    border: 'border-l-yellow-500',
    dot: 'bg-yellow-500',
    tint: 'bg-yellow-50/60 dark:bg-yellow-950/20',
  },
  e: {
    badge:
      'border-transparent bg-lime-100 text-lime-800 dark:bg-lime-950/50 dark:text-lime-200',
    border: 'border-l-lime-500',
    dot: 'bg-lime-500',
    tint: 'bg-lime-50/60 dark:bg-lime-950/20',
  },
  f: {
    badge:
      'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
    border: 'border-l-emerald-500',
    dot: 'bg-emerald-500',
    tint: 'bg-emerald-50/60 dark:bg-emerald-950/20',
  },
  g: {
    badge:
      'border-transparent bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-200',
    border: 'border-l-teal-500',
    dot: 'bg-teal-500',
    tint: 'bg-teal-50/60 dark:bg-teal-950/20',
  },
  h: {
    badge:
      'border-transparent bg-cyan-100 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200',
    border: 'border-l-cyan-500',
    dot: 'bg-cyan-500',
    tint: 'bg-cyan-50/60 dark:bg-cyan-950/20',
  },
  i: {
    badge:
      'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200',
    border: 'border-l-sky-500',
    dot: 'bg-sky-500',
    tint: 'bg-sky-50/60 dark:bg-sky-950/20',
  },
  j: {
    badge:
      'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200',
    border: 'border-l-blue-500',
    dot: 'bg-blue-500',
    tint: 'bg-blue-50/60 dark:bg-blue-950/20',
  },
  k: {
    badge:
      'border-transparent bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200',
    border: 'border-l-violet-500',
    dot: 'bg-violet-500',
    tint: 'bg-violet-50/60 dark:bg-violet-950/20',
  },
  l: {
    badge:
      'border-transparent bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/50 dark:text-fuchsia-200',
    border: 'border-l-fuchsia-500',
    dot: 'bg-fuchsia-500',
    tint: 'bg-fuchsia-50/60 dark:bg-fuchsia-950/20',
  },
};

/** Fallback neutre (groupe inconnu / pas encore assigné). */
const NEUTRAL_COLOR: GroupColor = {
  badge: 'border-transparent bg-muted text-muted-foreground',
  border: 'border-l-border',
  dot: 'bg-muted-foreground',
  tint: 'bg-muted/40',
};

/**
 * Retourne les classes couleur pour un groupe donné.
 * Accepte indifféremment 'A' ou 'a'. Renvoie le fallback neutre sinon.
 */
export const getGroupColor = (groupe: string | null | undefined): GroupColor => {
  if (!groupe) return NEUTRAL_COLOR;
  const key = groupe.trim().toLowerCase() as GroupLetter;
  return GROUP_COLORS[key] ?? NEUTRAL_COLOR;
};
