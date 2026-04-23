import { Loader2, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { type UserJokerHistoryRow } from './api';
import { resolveJokerIcon } from './joker-icon';
import {
  type JokerCategory,
  compareUserJokerByLastActivity,
  pickLocalized,
} from './schemas';
import { useUserJokersHistoryQuery } from './use-jokers';

/**
 * Styles Tailwind par catégorie (chaînes complètes pour ne pas être
 * purgées par le JIT). Teintes calquées sur `JokerTile` pour rester
 * cohérent avec la section "Mes jokers" d'une fiche concours.
 */
const CATEGORY_ICON_STYLES: Record<JokerCategory, string> = {
  boost: 'text-amber-600 dark:text-amber-400',
  info: 'text-sky-600 dark:text-sky-400',
  challenge: 'text-rose-600 dark:text-rose-400',
  social: 'text-emerald-600 dark:text-emerald-400',
};

const CATEGORY_RING_STYLES: Record<JokerCategory, string> = {
  boost:
    'border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/30',
  info: 'border-sky-200 bg-sky-50 dark:border-sky-800/60 dark:bg-sky-950/30',
  challenge:
    'border-rose-200 bg-rose-50 dark:border-rose-800/60 dark:bg-rose-950/30',
  social:
    'border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/30',
};

type Props = {
  userId: string | undefined;
};

/**
 * Section "Historique des jokers" à insérer sur la page profil
 * (après "Mes badges").
 *
 * Affiche une timeline cross-concours :
 *   - slots `owned` (used_at null) ET slots `used` confondus,
 *   - triés par activité la plus récente (max(used_at, acquired_at) DESC),
 *   - chaque ligne porte le nom du concours parent (Link vers la fiche).
 *
 * Pas de Realtime dédié : `useConsumeJokerMutation` + le Realtime
 * concours courant invalident déjà `jokersKeys.all` qui englobe la
 * clé `userHistory(userId)`.
 */
export const HistoriqueJokersSection = ({ userId }: Props) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('en') ? 'en' : 'fr';

  const historyQuery = useUserJokersHistoryQuery(userId);

  const sorted = useMemo<UserJokerHistoryRow[]>(() => {
    const data = historyQuery.data ?? [];
    return [...data].sort(compareUserJokerByLastActivity);
  }, [historyQuery.data]);

  const totalCount = sorted.length;
  const usedCount = sorted.filter((r) => r.used_at !== null).length;
  const ownedCount = totalCount - usedCount;

  const isLoading = historyQuery.isLoading;
  const isError = historyQuery.isError;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" aria-hidden />
        </div>
        <div className="flex flex-1 flex-col">
          <CardTitle className="text-lg">
            {t('jokers.history.title')}
          </CardTitle>
          <CardDescription>
            {t('jokers.history.progress', {
              owned: ownedCount,
              used: usedCount,
              total: totalCount,
            })}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {isError ? (
          <p className="text-sm text-destructive">
            {t('jokers.history.loadError')}
          </p>
        ) : isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('jokers.history.loading')}
          </div>
        ) : totalCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('jokers.history.empty')}
          </p>
        ) : (
          <ul
            role="list"
            aria-label={t('jokers.history.listAriaLabel')}
            className="flex flex-col gap-2"
          >
            {sorted.map((row) => {
              const isOwned = row.used_at === null;
              const Icon = resolveJokerIcon(row.joker.icon);
              const libelleText = pickLocalized(row.joker.libelle, lang);
              const activityDate = row.used_at ?? row.acquired_at;

              return (
                <li
                  key={row.id}
                  data-owned={isOwned}
                  data-category={row.joker.category}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                    isOwned
                      ? CATEGORY_RING_STYLES[row.joker.category]
                      : 'border-dashed border-muted bg-muted/30',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background',
                      isOwned
                        ? CATEGORY_ICON_STYLES[row.joker.category]
                        : 'text-muted-foreground',
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          isOwned ? undefined : 'text-muted-foreground',
                        )}
                      >
                        {libelleText}
                      </span>
                      <Badge
                        variant={isOwned ? 'default' : 'outline'}
                        className="text-[10px] uppercase tracking-wide"
                      >
                        {isOwned
                          ? t('jokers.history.item.statusOwned')
                          : t('jokers.history.item.statusUsed')}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span>
                        {t('jokers.history.item.concoursLabel')}{' '}
                        <Link
                          to={`/app/concours/${row.concours.id}`}
                          className="font-medium text-foreground underline-offset-2 hover:underline"
                        >
                          {row.concours.nom}
                        </Link>
                      </span>
                      <span aria-hidden>·</span>
                      <span>
                        {isOwned
                          ? t('jokers.history.item.acquiredLabel', {
                              date: formatDate(activityDate),
                            })
                          : t('jokers.history.item.usedLabel', {
                              date: formatDate(activityDate),
                            })}
                      </span>
                      <span aria-hidden>·</span>
                      <span className="uppercase tracking-wide opacity-80">
                        {t(`jokers.acquiredFrom.${row.acquired_from}`)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
