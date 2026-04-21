import { Loader2, Trophy } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { BadgeTile } from './badge-tile';
import {
  type BadgeCatalogRow,
  BADGE_TIER_RANK,
  type UserBadgeWithCatalog,
} from './schemas';
import {
  useBadgesCatalogQuery,
  useUserBadgesQuery,
  useUserBadgesRealtime,
} from './use-badges';

type Props = {
  userId: string | undefined;
};

type TileEntry = {
  badge: BadgeCatalogRow;
  earned: boolean;
  earnedAt?: string;
};

/**
 * Assemble les 2 sources (catalogue + badges de l'user) en une seule
 * liste de tuiles triées :
 *   1) gagnés avant les non-gagnés,
 *   2) tier desc (legendary > gold > silver > bronze) chez les gagnés,
 *   3) tier asc puis sort_order asc chez les non-gagnés (objectifs
 *      "faciles" en premier pour donner envie).
 */
const buildTiles = (
  catalog: BadgeCatalogRow[],
  earned: UserBadgeWithCatalog[],
): TileEntry[] => {
  const earnedMap = new Map(earned.map((e) => [e.badge_code, e]));

  const entries: TileEntry[] = catalog.map((badge) => {
    const ub = earnedMap.get(badge.code);
    return {
      badge,
      earned: Boolean(ub),
      earnedAt: ub?.earned_at,
    };
  });

  return entries.sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;

    if (a.earned) {
      // Gagnés : tier desc (legendary first)
      const tierDiff = BADGE_TIER_RANK[a.badge.tier] - BADGE_TIER_RANK[b.badge.tier];
      if (tierDiff !== 0) return tierDiff;
      // À tier égal : plus récent en premier
      if (a.earnedAt && b.earnedAt) {
        return b.earnedAt.localeCompare(a.earnedAt);
      }
    } else {
      // Non gagnés : tier asc (bronze first = plus accessibles)
      const tierDiff = BADGE_TIER_RANK[b.badge.tier] - BADGE_TIER_RANK[a.badge.tier];
      if (tierDiff !== 0) return tierDiff;
    }

    // Fallback : ordre de seed
    return a.badge.sort_order - b.badge.sort_order;
  });
};

/**
 * Section "Mes badges" à insérer dans la page profil.
 *
 * - Branchée sur `useBadgesCatalogQuery` (stale 1h, immuable) +
 *   `useUserBadgesQuery` (stale 30s) + `useUserBadgesRealtime` pour
 *   recevoir les nouveaux badges attribués en temps réel par les
 *   triggers SQL.
 * - États : loading / error / vide / normal.
 * - Responsive : 2 cols mobile, 3 sur sm, 4 sur md, 5 sur lg.
 */
export const MyBadgesSection = ({ userId }: Props) => {
  const { t } = useTranslation();
  const catalogQuery = useBadgesCatalogQuery();
  const userBadgesQuery = useUserBadgesQuery(userId);
  useUserBadgesRealtime(userId);

  const tiles = useMemo(() => {
    if (!catalogQuery.data) return [];
    return buildTiles(catalogQuery.data, userBadgesQuery.data ?? []);
  }, [catalogQuery.data, userBadgesQuery.data]);

  const earnedCount = userBadgesQuery.data?.length ?? 0;
  const totalCount = catalogQuery.data?.length ?? 0;

  const isLoading = catalogQuery.isLoading || userBadgesQuery.isLoading;
  const isError = catalogQuery.isError || userBadgesQuery.isError;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <Trophy className="h-5 w-5" aria-hidden />
        </div>
        <div className="flex flex-1 flex-col">
          <CardTitle className="text-lg">{t('badges.section.title')}</CardTitle>
          <CardDescription>
            {t('badges.section.progress', {
              earned: earnedCount,
              total: totalCount,
            })}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {isError ? (
          <p className="text-sm text-destructive">{t('badges.section.loadError')}</p>
        ) : isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('badges.section.loading')}
          </div>
        ) : totalCount === 0 ? (
          <p className="text-sm text-muted-foreground">{t('badges.section.empty')}</p>
        ) : (
          <div
            role="list"
            aria-label={t('badges.section.gridAriaLabel')}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
          >
            {tiles.map((entry) => (
              <BadgeTile
                key={entry.badge.code}
                badge={entry.badge}
                earned={entry.earned}
                earnedAt={entry.earnedAt}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
