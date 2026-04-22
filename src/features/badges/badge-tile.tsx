import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import { resolveBadgeIcon } from './badge-icon';
import {
  type BadgeCatalogRow,
  type BadgeTier,
  pickLocalized,
} from './schemas';

/**
 * Couleurs Tailwind par tier, en light + dark, appliquées sur la bordure
 * + fond légèrement teinté de la tuile. Ces classes doivent rester des
 * chaînes complètes pour ne pas être purgées par Tailwind JIT.
 */
const TIER_STYLES: Record<BadgeTier, string> = {
  bronze:
    'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  silver:
    'border-slate-300 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200',
  gold: 'border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200',
  legendary:
    'border-purple-300 bg-purple-50 text-purple-900 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-200',
};

/**
 * Shadows teintées par tier : les badges prestigieux (gold / legendary)
 * récupèrent la shadow colorée `shadow-accent` du DS ; les plus communs
 * restent sur une ombre neutre. Hover légèrement amplifié pour un feel
 * tactile sur mobile.
 */
const TIER_SHADOWS: Record<BadgeTier, string> = {
  bronze: 'shadow-sm hover:shadow-md',
  silver: 'shadow-sm hover:shadow-md',
  gold: 'shadow-md hover:shadow-accent',
  legendary: 'shadow-accent hover:shadow-accent',
};

/**
 * Couleurs de l'icône (plus saturée que le fond pour ressortir).
 */
const TIER_ICON_STYLES: Record<BadgeTier, string> = {
  bronze: 'text-amber-600 dark:text-amber-400',
  silver: 'text-slate-600 dark:text-slate-300',
  gold: 'text-yellow-600 dark:text-yellow-400',
  legendary: 'text-purple-600 dark:text-purple-400',
};

export type BadgeTileProps = {
  badge: BadgeCatalogRow;
  /** true = badge gagné, false = badge à conquérir (grisé). */
  earned: boolean;
  /** Date ISO du gain (uniquement si `earned`). Affichée sous le libellé. */
  earnedAt?: string;
};

/**
 * Tuile unique représentant un badge :
 *   - earned = true  : tuile teintée selon le tier, icône colorée,
 *     date de gain affichée en dessous.
 *   - earned = false : tuile grisée / opacity 50 %, description visible
 *     pour indiquer comment le décrocher.
 */
export const BadgeTile = ({ badge, earned, earnedAt }: BadgeTileProps) => {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('en') ? 'en' : 'fr';
  const libelle = pickLocalized(badge.libelle, lang);
  const description = pickLocalized(badge.description, lang);
  const Icon = resolveBadgeIcon(badge.icon);

  const earnedDate = earnedAt
    ? new Date(earnedAt).toLocaleDateString(lang, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div
      role="listitem"
      aria-label={libelle}
      data-earned={earned}
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all duration-base ease-standard',
        earned
          ? cn(TIER_STYLES[badge.tier], TIER_SHADOWS[badge.tier])
          : 'border-dashed border-muted bg-muted/30 text-muted-foreground opacity-60 grayscale',
      )}
    >
      <Icon
        className={cn(
          'h-8 w-8',
          earned ? TIER_ICON_STYLES[badge.tier] : 'text-muted-foreground',
        )}
        aria-hidden
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold leading-tight">{libelle}</span>
        <span className="text-xs leading-snug opacity-80">{description}</span>
      </div>
      {earned && earnedDate ? (
        <span className="text-[10px] uppercase tracking-wide opacity-70">
          {earnedDate}
        </span>
      ) : null}
    </div>
  );
};
