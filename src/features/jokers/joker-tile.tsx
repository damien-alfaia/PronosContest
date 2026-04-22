import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { resolveJokerIcon } from './joker-icon';
import {
  type JokerAcquiredFrom,
  type JokerCategory,
  type JokerLocalized,
  pickLocalized,
} from './schemas';

/**
 * Styles Tailwind par catégorie (chaînes complètes pour ne pas être
 * purgées par le JIT). Mêmes teintes light + dark que pour les badges,
 * adaptées à la taxonomie jokers (boost / info / challenge / social).
 */
const CATEGORY_STYLES: Record<JokerCategory, string> = {
  boost:
    'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  info: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200',
  challenge:
    'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200',
  social:
    'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
};

const CATEGORY_ICON_STYLES: Record<JokerCategory, string> = {
  boost: 'text-amber-600 dark:text-amber-400',
  info: 'text-sky-600 dark:text-sky-400',
  challenge: 'text-rose-600 dark:text-rose-400',
  social: 'text-emerald-600 dark:text-emerald-400',
};

const CATEGORY_SHADOWS: Record<JokerCategory, string> = {
  boost: 'shadow-sm hover:shadow-md',
  info: 'shadow-sm hover:shadow-md',
  challenge: 'shadow-sm hover:shadow-md',
  social: 'shadow-sm hover:shadow-md',
};

export type JokerTileProps = {
  libelle: JokerLocalized;
  description: JokerLocalized;
  icon: string;
  category: JokerCategory;
  /** true = slot possédé (used_at is null), false = slot consommé (used_at set). */
  owned: boolean;
  /** Origine du slot (starter / badge / gift). Facultatif : affiche un petit badge. */
  acquiredFrom?: JokerAcquiredFrom;
  /** Date ISO d'acquisition, affichée en bas si fournie. */
  acquiredAt?: string;
  /** Date ISO d'utilisation, affichée si `owned === false`. */
  usedAt?: string | null;
};

/**
 * Tuile unique représentant un joker possédé.
 *
 *   - owned = true  : tuile teintée selon la catégorie, description
 *     visible, acquired_from en petit badge.
 *   - owned = false : tuile atténuée (opacity + grayscale), date
 *     d'utilisation affichée si disponible.
 *
 * La consommation (RPC `use_joker`) arrive en Sprint 8.B : en 8.A on
 * se contente de lister / afficher.
 */
export const JokerTile = ({
  libelle,
  description,
  icon,
  category,
  owned,
  acquiredFrom,
  acquiredAt,
  usedAt,
}: JokerTileProps) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('en') ? 'en' : 'fr';
  const libelleText = pickLocalized(libelle, lang);
  const descriptionText = pickLocalized(description, lang);
  const Icon = resolveJokerIcon(icon);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div
      role="listitem"
      aria-label={libelleText}
      data-owned={owned}
      data-category={category}
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all duration-base ease-standard',
        owned
          ? cn(CATEGORY_STYLES[category], CATEGORY_SHADOWS[category])
          : 'border-dashed border-muted bg-muted/30 text-muted-foreground opacity-60 grayscale',
      )}
    >
      <Icon
        className={cn(
          'h-8 w-8',
          owned ? CATEGORY_ICON_STYLES[category] : 'text-muted-foreground',
        )}
        aria-hidden
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold leading-tight">
          {libelleText}
        </span>
        <span className="text-xs leading-snug opacity-80">
          {descriptionText}
        </span>
      </div>
      {acquiredFrom ? (
        <Badge
          variant="outline"
          className="text-[10px] uppercase tracking-wide"
        >
          {t(`jokers.acquiredFrom.${acquiredFrom}`)}
        </Badge>
      ) : null}
      {owned && acquiredAt ? (
        <span className="text-[10px] uppercase tracking-wide opacity-70">
          {t('jokers.section.acquiredOn', { date: formatDate(acquiredAt) })}
        </span>
      ) : null}
      {!owned && usedAt ? (
        <span className="text-[10px] uppercase tracking-wide opacity-70">
          {t('jokers.section.usedOn', { date: formatDate(usedAt) })}
        </span>
      ) : null}
    </div>
  );
};
