import { Loader2, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { JokerTile } from './joker-tile';
import {
  compareUserJokerForInventory,
  type UserJokerWithCatalog,
} from './schemas';
import {
  useUserJokersInConcoursQuery,
  useUserJokersRealtime,
} from './use-jokers';

type Props = {
  userId: string | undefined;
  concoursId: string | undefined;
  /** Si false → section non montée (concours avec jokers_enabled=false). */
  enabled: boolean;
};

/**
 * Section "Mes jokers" à insérer sur la fiche concours (sous la carte
 * des participants), visible uniquement si :
 *   - l'utilisateur est authentifié,
 *   - le concours a `jokers_enabled = true`.
 *
 * Les acquisitions passent par des triggers SQL ; côté front on liste
 * via `useUserJokersInConcoursQuery` (stale 30s) et on invalide via
 * `useUserJokersRealtime` sur event INSERT/UPDATE/DELETE `user_jokers`.
 *
 * Tri (dans `compareUserJokerForInventory`) :
 *   1) owned en premier, used ensuite,
 *   2) ordre catalogue (category rank → sort_order → code),
 *   3) acquired_at desc.
 *
 * Layout : grid 2 → 3 → 4 → 5 colonnes (cohérent avec la section badges
 * sur la page profil).
 */
export const MyJokersSection = ({ userId, concoursId, enabled }: Props) => {
  const { t } = useTranslation();

  const jokersQuery = useUserJokersInConcoursQuery(
    enabled ? userId : undefined,
    enabled ? concoursId : undefined,
  );
  useUserJokersRealtime(userId, concoursId, { enabled });

  const sorted = useMemo<UserJokerWithCatalog[]>(() => {
    const data = jokersQuery.data ?? [];
    return [...data].sort(compareUserJokerForInventory);
  }, [jokersQuery.data]);

  if (!enabled) return null;

  const ownedCount = sorted.filter((r) => r.used_at === null).length;
  const totalCount = sorted.length;

  const isLoading = jokersQuery.isLoading;
  const isError = jokersQuery.isError;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" aria-hidden />
        </div>
        <div className="flex flex-1 flex-col">
          <CardTitle className="text-lg">{t('jokers.section.title')}</CardTitle>
          <CardDescription>
            {t('jokers.section.progress', {
              owned: ownedCount,
              total: totalCount,
            })}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {isError ? (
          <p className="text-sm text-destructive">
            {t('jokers.section.loadError')}
          </p>
        ) : isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('jokers.section.loading')}
          </div>
        ) : totalCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('jokers.section.empty')}
          </p>
        ) : (
          <div
            role="list"
            aria-label={t('jokers.section.gridAriaLabel')}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
          >
            {sorted.map((row) => (
              <JokerTile
                key={row.id}
                libelle={row.joker.libelle}
                description={row.joker.description}
                icon={row.joker.icon}
                category={row.joker.category}
                owned={row.used_at === null}
                acquiredFrom={row.acquired_from}
                acquiredAt={row.acquired_at}
                usedAt={row.used_at}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
