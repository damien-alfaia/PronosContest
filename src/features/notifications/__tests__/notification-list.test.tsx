import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { NotificationList } from '@/features/notifications/notification-list';
import type { Notification } from '@/features/notifications/schemas';
import { i18n } from '@/i18n';

/**
 * Tests de `<NotificationList />`.
 *
 * On vérifie :
 *   - États : loading / error / empty / normal.
 *   - Bouton "Charger plus" visible uniquement si hasNextPage=true,
 *     disabled + label alternatif pendant isFetchingNextPage.
 *   - Click "Charger plus" → onLoadMore().
 *   - Chaque notif est rendue comme un NotificationItem (role=button).
 */

const UUID = (i: number) =>
  `${String(i).repeat(8)}-1111-1111-1111-111111111111`.slice(0, 36);

const makeNotif = (i: number, read = false): Notification =>
  ({
    id: UUID(i),
    user_id: 'u1111111-1111-1111-1111-111111111111',
    type: 'badge_earned',
    title: `Notif #${i}`,
    body: `Body ${i}`,
    payload: {
      badge_code: 'rookie',
      earned_at: '2026-04-21T10:00:00Z',
      metadata: {},
    },
    read_at: read ? '2026-04-21T11:00:00Z' : null,
    created_at: '2026-04-21T10:00:00Z',
  }) as Notification;

const renderList = (props: Parameters<typeof NotificationList>[0]) =>
  render(
    <MemoryRouter>
      <NotificationList {...props} />
    </MemoryRouter>,
  );

beforeAll(async () => {
  await i18n.changeLanguage('fr');
});

describe('<NotificationList />', () => {
  const baseProps = {
    notifications: [],
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    onLoadMore: () => {},
    onMarkAsRead: () => {},
  };

  it('affiche le loader pendant isLoading', () => {
    renderList({ ...baseProps, isLoading: true });
    expect(
      screen.getByText(i18n.t('notifications.list.loading')),
    ).toBeInTheDocument();
  });

  it('affiche l\'erreur quand isError=true', () => {
    renderList({ ...baseProps, isError: true });
    expect(
      screen.getByText(i18n.t('notifications.list.loadError')),
    ).toBeInTheDocument();
  });

  it('affiche l\'empty state si notifications=[]', () => {
    renderList(baseProps);
    expect(
      screen.getByText(i18n.t('notifications.list.empty.title')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('notifications.list.empty.description')),
    ).toBeInTheDocument();
  });

  it('rend un NotificationItem par notif (role=button)', () => {
    renderList({
      ...baseProps,
      notifications: [makeNotif(1), makeNotif(2), makeNotif(3, true)],
    });
    // 3 boutons cliquables
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('expose la liste sous role=list avec aria-label i18n', () => {
    renderList({
      ...baseProps,
      notifications: [makeNotif(1)],
    });
    expect(
      screen.getByRole('list', {
        name: i18n.t('notifications.list.ariaLabel'),
      }),
    ).toBeInTheDocument();
  });

  it('masque le bouton "Charger plus" si hasNextPage=false', () => {
    renderList({
      ...baseProps,
      notifications: [makeNotif(1)],
      hasNextPage: false,
    });
    expect(
      screen.queryByRole('button', {
        name: new RegExp(i18n.t('notifications.list.loadMore'), 'i'),
      }),
    ).not.toBeInTheDocument();
  });

  it('affiche le bouton "Charger plus" si hasNextPage=true', () => {
    renderList({
      ...baseProps,
      notifications: [makeNotif(1)],
      hasNextPage: true,
    });
    expect(
      screen.getByRole('button', {
        name: new RegExp(i18n.t('notifications.list.loadMore'), 'i'),
      }),
    ).toBeInTheDocument();
  });

  it('click sur "Charger plus" appelle onLoadMore', () => {
    const onLoadMore = vi.fn();
    renderList({
      ...baseProps,
      notifications: [makeNotif(1)],
      hasNextPage: true,
      onLoadMore,
    });
    const btn = screen.getByRole('button', {
      name: new RegExp(i18n.t('notifications.list.loadMore'), 'i'),
    });
    act(() => {
      btn.click();
    });
    expect(onLoadMore).toHaveBeenCalled();
  });

  it('affiche le label "Chargement…" pendant isFetchingNextPage', () => {
    renderList({
      ...baseProps,
      notifications: [makeNotif(1)],
      hasNextPage: true,
      isFetchingNextPage: true,
    });
    expect(
      screen.getByText(i18n.t('notifications.list.loadingMore')),
    ).toBeInTheDocument();
  });
});
