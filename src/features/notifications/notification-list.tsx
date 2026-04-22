import { Bell, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

import { NotificationItem } from './notification-item';
import { type Notification } from './schemas';

/**
 * Liste des notifications rendues à l'intérieur de la pop-up cloche.
 *
 * Responsabilités :
 *   - Rendu des états loading / error / empty / normal.
 *   - Pagination "Charger plus" en bas de la liste (quand
 *     `hasNextPage === true`).
 *   - Délégation du clic sur un item au composant `NotificationItem`
 *     qui gère mark-as-read + navigation.
 *
 * Tous les événements de mutation (`onMarkAsRead`) remontent au parent
 * pour garder ce composant "dumb" — on peut ainsi le tester en
 * isolation sans avoir à monter un QueryClient.
 */

type NotificationListProps = {
  notifications: Notification[];
  isLoading: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onMarkAsRead: (id: string) => void;
  /** Fermeture de la pop-up après navigation. */
  onItemClick?: () => void;
};

export const NotificationList = ({
  notifications,
  isLoading,
  isError,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onMarkAsRead,
  onItemClick,
}: NotificationListProps) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-8"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="sr-only">{t('notifications.list.loading')}</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-4 py-8 text-center text-sm text-destructive">
        {t('notifications.list.loadError')}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
          aria-hidden
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
        </span>
        <p className="text-sm font-medium text-foreground">
          {t('notifications.list.empty.title')}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('notifications.list.empty.description')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <ul
        className="flex flex-col divide-y divide-border"
        role="list"
        aria-label={t('notifications.list.ariaLabel')}
      >
        {notifications.map((n) => (
          <li key={n.id}>
            <NotificationItem
              notification={n}
              onMarkAsRead={onMarkAsRead}
              onNavigate={onItemClick}
            />
          </li>
        ))}
      </ul>

      {hasNextPage ? (
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={isFetchingNextPage}
            onClick={onLoadMore}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('notifications.list.loadingMore')}
              </>
            ) : (
              t('notifications.list.loadMore')
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
