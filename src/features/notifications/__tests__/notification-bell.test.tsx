import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react';
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { NotificationBell } from '@/features/notifications/notification-bell';
import type { Notification } from '@/features/notifications/schemas';
import type { NotificationsInfiniteData } from '@/features/notifications/use-notifications';
import { i18n } from '@/i18n';

/**
 * Tests de `<NotificationBell />`.
 *
 * On mocke :
 *   - `use-notifications` : pilotage des queries + des mutations +
 *     remplacement de `useNotificationsRealtime` par un spy.
 *   - `@/hooks/use-auth` : user fixe.
 *
 * Invariants couverts :
 *   - Badge rouge avec le compteur quand > 0, caché si 0.
 *   - Badge affiche "99+" au-delà de 99.
 *   - Panneau fermé par défaut, ouvert après un click sur le bouton.
 *   - Liste rendue à l'intérieur du panneau (role=dialog).
 *   - Bouton "Tout marquer comme lu" désactivé quand unread=0, actif
 *     sinon + appelle la mutation au click.
 *   - useNotificationsRealtime appelé avec l'userId + enabled=true.
 *   - Si user absent → la cloche ne rend rien.
 */

const USER = 'u1111111-1111-1111-1111-111111111111';
const UUID_NOTIF = '22222222-2222-2222-2222-222222222222';

const makeNotif = (overrides: Partial<Notification> = {}): Notification =>
  ({
    id: UUID_NOTIF,
    user_id: USER,
    type: 'badge_earned',
    title: 'Nouveau badge',
    body: 'Tu viens de débloquer un badge !',
    payload: {
      badge_code: 'rookie',
      earned_at: '2026-04-21T10:00:00Z',
      metadata: {},
    },
    read_at: null,
    created_at: '2026-04-21T10:00:00Z',
    ...overrides,
  }) as Notification;

// ---- Hoisted mocks ----

const mocks = vi.hoisted(() => ({
  userState: { user: { id: USER } as { id: string } | null },
  listState: {
    data: undefined as NotificationsInfiniteData | undefined,
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPageSpy: vi.fn(),
  },
  countState: { data: 0 as number | undefined },
  realtimeSpy: vi.fn(),
  markAsReadSpy: vi.fn(),
  markAllAsReadSpy: vi.fn(),
}));

vi.mock('@/features/notifications/use-notifications', async () => {
  const actual = (await vi.importActual(
    '@/features/notifications/use-notifications',
  )) as Record<string, unknown>;
  return {
    ...actual,
    useNotificationsInfiniteQuery: () => ({
      data: mocks.listState.data,
      isLoading: mocks.listState.isLoading,
      isError: mocks.listState.isError,
      hasNextPage: mocks.listState.hasNextPage,
      isFetchingNextPage: mocks.listState.isFetchingNextPage,
      fetchNextPage: mocks.listState.fetchNextPageSpy,
    }),
    useUnreadCountQuery: () => ({
      data: mocks.countState.data,
      isLoading: false,
      isError: false,
    }),
    useMarkAsReadMutation: () => ({
      mutate: mocks.markAsReadSpy,
      isPending: false,
    }),
    useMarkAllAsReadMutation: () => ({
      mutate: mocks.markAllAsReadSpy,
      isPending: false,
    }),
    useNotificationsRealtime: (
      userId: string | undefined,
      options: { enabled?: boolean } = {},
    ) => {
      mocks.realtimeSpy(userId, options);
    },
  };
});

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: mocks.userState.user }),
}));

// ---- Helpers ----

const renderBell = () =>
  render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>,
  );

const setPages = (notifs: Notification[][]) => {
  mocks.listState.data = {
    pages: notifs,
    pageParams: notifs.map(() => undefined),
  } as NotificationsInfiniteData;
};

beforeAll(async () => {
  await i18n.changeLanguage('fr');
});

beforeEach(() => {
  mocks.userState.user = { id: USER };
  mocks.listState.data = undefined;
  mocks.listState.isLoading = false;
  mocks.listState.isError = false;
  mocks.listState.hasNextPage = false;
  mocks.listState.isFetchingNextPage = false;
  mocks.listState.fetchNextPageSpy.mockReset();
  mocks.countState.data = 0;
  mocks.realtimeSpy.mockReset();
  mocks.markAsReadSpy.mockReset();
  mocks.markAllAsReadSpy.mockReset();
});

// ------------------------------------------------------------------
//  Garde d'auth
// ------------------------------------------------------------------

describe('<NotificationBell /> — garde d\'auth', () => {
  it('ne rend rien si user est null', () => {
    mocks.userState.user = null;
    const { container } = renderBell();
    expect(container.firstChild).toBeNull();
  });
});

// ------------------------------------------------------------------
//  Badge compteur
// ------------------------------------------------------------------

describe('<NotificationBell /> — badge compteur', () => {
  it('masque le badge quand unread=0', () => {
    mocks.countState.data = 0;
    renderBell();
    // Le bouton est rendu, mais pas de texte chiffré à côté.
    const button = screen.getByRole('button');
    expect(button.textContent).not.toMatch(/\d/);
  });

  it('affiche le compteur quand unread>0', () => {
    mocks.countState.data = 5;
    renderBell();
    const button = screen.getByRole('button');
    expect(button.textContent).toContain('5');
  });

  it('affiche "99+" au-delà de 99', () => {
    mocks.countState.data = 250;
    renderBell();
    const button = screen.getByRole('button');
    expect(button.textContent).toContain('99+');
  });
});

// ------------------------------------------------------------------
//  Ouverture / fermeture du panneau
// ------------------------------------------------------------------

describe('<NotificationBell /> — panneau', () => {
  it('panneau fermé par défaut', () => {
    renderBell();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('click sur la cloche ouvre le panneau (role=dialog)', () => {
    renderBell();
    act(() => {
      screen.getByRole('button').click();
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('2e click ferme le panneau', () => {
    renderBell();
    const bellBtn = screen.getByRole('button');
    act(() => {
      bellBtn.click();
    });
    act(() => {
      bellBtn.click();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('aria-expanded reflète l\'état', () => {
    renderBell();
    const bellBtn = screen.getByRole('button');
    expect(bellBtn).toHaveAttribute('aria-expanded', 'false');
    act(() => {
      bellBtn.click();
    });
    expect(bellBtn).toHaveAttribute('aria-expanded', 'true');
  });
});

// ------------------------------------------------------------------
//  Mark all as read
// ------------------------------------------------------------------

describe('<NotificationBell /> — mark all as read', () => {
  it('bouton désactivé quand unread=0', () => {
    mocks.countState.data = 0;
    renderBell();
    act(() => {
      screen.getByRole('button').click();
    });
    const markAll = screen.getByRole('button', {
      name: new RegExp(i18n.t('notifications.bell.markAllAsRead'), 'i'),
    });
    expect(markAll).toBeDisabled();
  });

  it('bouton actif quand unread>0 + click → mutation', () => {
    mocks.countState.data = 3;
    setPages([[makeNotif()]]);
    renderBell();
    act(() => {
      screen.getByRole('button').click();
    });
    const markAll = screen.getByRole('button', {
      name: new RegExp(i18n.t('notifications.bell.markAllAsRead'), 'i'),
    });
    expect(markAll).not.toBeDisabled();
    act(() => {
      markAll.click();
    });
    expect(mocks.markAllAsReadSpy).toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------
//  Realtime wiring
// ------------------------------------------------------------------

describe('<NotificationBell /> — realtime', () => {
  it('souscrit avec userId + enabled=true', () => {
    mocks.countState.data = 0;
    renderBell();
    expect(mocks.realtimeSpy).toHaveBeenCalledWith(USER, { enabled: true });
  });
});

// ------------------------------------------------------------------
//  Contenu du panneau
// ------------------------------------------------------------------

describe('<NotificationBell /> — contenu panneau', () => {
  it('rend les notifications quand le panneau est ouvert', () => {
    setPages([[makeNotif({ title: 'Notif 1', body: 'Body 1' })]]);
    mocks.countState.data = 1;
    renderBell();
    act(() => {
      screen.getByRole('button', { expanded: false }).click();
    });
    expect(screen.getByText('Notif 1')).toBeInTheDocument();
    expect(screen.getByText('Body 1')).toBeInTheDocument();
  });

  it('affiche l\'empty state si aucune notif', () => {
    setPages([[]]);
    mocks.countState.data = 0;
    renderBell();
    act(() => {
      screen.getByRole('button').click();
    });
    expect(
      screen.getByText(i18n.t('notifications.list.empty.title')),
    ).toBeInTheDocument();
  });
});
