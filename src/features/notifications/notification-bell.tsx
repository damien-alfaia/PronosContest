import { Bell, CheckCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

import { NotificationList } from './notification-list';
import {
  flattenNotifications,
  useMarkAllAsReadMutation,
  useMarkAsReadMutation,
  useNotificationsInfiniteQuery,
  useNotificationsRealtime,
  useUnreadCountQuery,
} from './use-notifications';

/**
 * Cloche de notifications montée dans la Topbar.
 *
 * Comportement :
 *   - Bouton icône Bell + pastille rouge avec compteur (caché si 0).
 *   - Clic → ouvre un panneau `role="dialog"` ancré en bas à droite
 *     du bouton (custom — pas de primitive Popover shadcn installée).
 *   - Panneau : en-tête (titre + "Tout marquer comme lu"), liste
 *     paginée via `NotificationList`, footer discret avec le compteur
 *     non-lues si > 0.
 *   - Fermeture :
 *       · clic en dehors (listener `mousedown` global),
 *       · touche `Escape`,
 *       · clic sur un item (la nav route change déjà la page, mais on
 *         ferme aussi pour le cas SPA de nav vers la même route).
 *
 * Le hook `useNotificationsRealtime` souscrit dès que l'user est
 * authentifié — l'incrément du compteur continue même si la pop-up
 * n'a jamais été ouverte.
 *
 * Décision produit : le mark-as-read est **explicite au clic** sur un
 * item ou via le bouton "Tout marquer comme lu". Ouvrir la pop-up
 * n'auto-marque PAS les notifs comme lues (l'utilisateur peut vouloir
 * scanner rapidement puis revenir plus tard).
 */

const MAX_BADGE_COUNT = 99;

export const NotificationBell = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id;

  const [isOpen, setIsOpen] = useState(false);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // --- Data layer --------------------------------------------------

  const countQuery = useUnreadCountQuery(userId);
  const listQuery = useNotificationsInfiniteQuery(userId);
  const markAsRead = useMarkAsReadMutation(userId);
  const markAllAsRead = useMarkAllAsReadMutation(userId);

  // Realtime branché tant qu'on est connecté — le badge reste à jour
  // même si le panneau n'a jamais été ouvert.
  useNotificationsRealtime(userId, { enabled: Boolean(userId) });

  const notifications = flattenNotifications(listQuery.data);
  const unread = countQuery.data ?? 0;

  // --- Ouverture / fermeture --------------------------------------

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      close();
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, close]);

  const toggleOpen = () => setIsOpen((o) => !o);

  // --- Actions -----------------------------------------------------

  const handleMarkAsRead = (id: string) => {
    markAsRead.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    if (unread === 0) return;
    markAllAsRead.mutate();
  };

  const handleLoadMore = () => {
    if (listQuery.hasNextPage && !listQuery.isFetchingNextPage) {
      void listQuery.fetchNextPage();
    }
  };

  // Si user non connecté (guard AppLayout normalement couvre le cas)
  // on ne rend rien — la cloche est uniquement dans une session authent.
  if (!userId) return null;

  const badgeLabel =
    unread > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(unread);

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        className="relative"
        aria-label={t('notifications.bell.ariaLabel', { count: unread })}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={toggleOpen}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
            aria-hidden
          >
            {badgeLabel}
          </span>
        ) : null}
      </Button>

      {isOpen ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t('notifications.bell.dialogLabel')}
          className={cn(
            'absolute right-0 top-full z-30 mt-2 w-[22rem] max-w-[calc(100vw-1rem)]',
            'overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg',
          )}
        >
          <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <h2 className="text-sm font-semibold">
              {t('notifications.bell.title')}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={unread === 0 || markAllAsRead.isPending}
              onClick={handleMarkAllAsRead}
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden />
              {t('notifications.bell.markAllAsRead')}
            </Button>
          </header>

          <div className="max-h-[70vh] overflow-y-auto">
            <NotificationList
              notifications={notifications}
              isLoading={listQuery.isLoading}
              isError={listQuery.isError}
              hasNextPage={Boolean(listQuery.hasNextPage)}
              isFetchingNextPage={listQuery.isFetchingNextPage}
              onLoadMore={handleLoadMore}
              onMarkAsRead={handleMarkAsRead}
              onItemClick={close}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
