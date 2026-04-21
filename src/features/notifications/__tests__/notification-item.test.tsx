import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { NotificationItem } from '@/features/notifications/notification-item';
import type { Notification } from '@/features/notifications/schemas';
import { i18n } from '@/i18n';

/**
 * Tests unitaires de `<NotificationItem />`.
 *
 * On vérifie :
 *   - Rendu du titre + body composé par type (match_result / badge_earned
 *     / concours_new_member / chat_mention).
 *   - Temps relatif (à l'instant / minutes / heures / jours / > 1 sem).
 *   - Dot "non lue" visible si `read_at === null`, absent sinon.
 *   - Click → appelle `onMarkAsRead(id)` uniquement si non lue.
 *   - Click → navigate vers la route adéquate selon le `type`.
 *   - Click sur une notif déjà lue → pas d'appel à `onMarkAsRead` (idempot).
 */

const UUID_A = '11111111-1111-1111-1111-111111111111';
const UUID_B = '22222222-2222-2222-2222-222222222222';
const UUID_C = '33333333-3333-3333-3333-333333333333';

const NOW = new Date('2026-04-21T12:00:00Z').getTime();

const makeBadgeNotif = (over: Partial<Notification> = {}): Notification =>
  ({
    id: UUID_A,
    user_id: UUID_B,
    type: 'badge_earned',
    title: null,
    body: null,
    payload: {
      badge_code: 'rookie',
      earned_at: '2026-04-21T11:59:00Z',
      metadata: {},
    },
    read_at: null,
    created_at: '2026-04-21T11:59:00Z',
    ...over,
  }) as Notification;

// Petit composant pour lire la location courante (test navigation).
const LocationReporter = () => {
  const location = useLocation();
  return <div data-testid="loc">{location.pathname}</div>;
};

const renderWithRouter = (element: React.ReactElement) =>
  render(
    <MemoryRouter initialEntries={['/app/start']}>
      <Routes>
        <Route path="/app/start" element={<>{element}<LocationReporter /></>} />
        <Route path="/app/*" element={<LocationReporter />} />
      </Routes>
    </MemoryRouter>,
  );

beforeAll(async () => {
  await i18n.changeLanguage('fr');
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

// ------------------------------------------------------------------
//  Rendu titre/body par type
// ------------------------------------------------------------------

describe('<NotificationItem /> — titre/body par type', () => {
  it('badge_earned : titre + body via i18n', () => {
    const onMark = vi.fn();
    renderWithRouter(
      <NotificationItem
        notification={makeBadgeNotif()}
        onMarkAsRead={onMark}
      />,
    );
    expect(
      screen.getByText(i18n.t('notifications.types.badgeEarned.title')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('notifications.types.badgeEarned.body')),
    ).toBeInTheDocument();
  });

  it('match_result avec scores : body = "Score final : a - b"', () => {
    const onMark = vi.fn();
    const notif: Notification = {
      id: UUID_A,
      user_id: UUID_B,
      type: 'match_result',
      title: null,
      body: null,
      payload: {
        match_id: UUID_A,
        competition_id: UUID_B,
        score_a: 3,
        score_b: 1,
        equipe_a_id: null,
        equipe_b_id: null,
        vainqueur_tab: null,
      },
      read_at: null,
      created_at: '2026-04-21T11:59:00Z',
    };

    renderWithRouter(
      <NotificationItem notification={notif} onMarkAsRead={onMark} />,
    );
    expect(screen.getByText(/3\s*-\s*1/)).toBeInTheDocument();
  });

  it('match_result sans scores : body = noScore', () => {
    const onMark = vi.fn();
    const notif: Notification = {
      id: UUID_A,
      user_id: UUID_B,
      type: 'match_result',
      title: null,
      body: null,
      payload: {
        match_id: UUID_A,
        competition_id: UUID_B,
        score_a: null,
        score_b: null,
        equipe_a_id: null,
        equipe_b_id: null,
        vainqueur_tab: null,
      },
      read_at: null,
      created_at: '2026-04-21T11:59:00Z',
    };

    renderWithRouter(
      <NotificationItem notification={notif} onMarkAsRead={onMark} />,
    );
    expect(
      screen.getByText(i18n.t('notifications.types.matchResult.body.noScore')),
    ).toBeInTheDocument();
  });

  it('concours_new_member : interpole le nom du concours', () => {
    const onMark = vi.fn();
    const notif: Notification = {
      id: UUID_A,
      user_id: UUID_B,
      type: 'concours_new_member',
      title: null,
      body: null,
      payload: {
        concours_id: UUID_C,
        concours_nom: 'Pronos entre potes',
        new_user_id: UUID_A,
      },
      read_at: null,
      created_at: '2026-04-21T11:59:00Z',
    };

    renderWithRouter(
      <NotificationItem notification={notif} onMarkAsRead={onMark} />,
    );
    expect(screen.getByText(/pronos entre potes/i)).toBeInTheDocument();
  });

  it('chat_mention : body = body_preview brut', () => {
    const onMark = vi.fn();
    const notif: Notification = {
      id: UUID_A,
      user_id: UUID_B,
      type: 'chat_mention',
      title: null,
      body: null,
      payload: {
        concours_id: UUID_C,
        message_id: UUID_A,
        mentioned_by: UUID_B,
        token: 'Alice Martin',
        match_type: 'full_name',
        body_preview: 'Hey @Alice Martin tu viens ?',
      },
      read_at: null,
      created_at: '2026-04-21T11:59:00Z',
    };

    renderWithRouter(
      <NotificationItem notification={notif} onMarkAsRead={onMark} />,
    );
    expect(
      screen.getByText('Hey @Alice Martin tu viens ?'),
    ).toBeInTheDocument();
  });

  it("title/body du serveur sont prioritaires s'ils sont remplis", () => {
    const onMark = vi.fn();
    renderWithRouter(
      <NotificationItem
        notification={makeBadgeNotif({
          title: 'Broadcast admin',
          body: 'Service indispo à 23 h',
        })}
        onMarkAsRead={onMark}
      />,
    );
    expect(screen.getByText('Broadcast admin')).toBeInTheDocument();
    expect(screen.getByText('Service indispo à 23 h')).toBeInTheDocument();
  });
});

// ------------------------------------------------------------------
//  Temps relatif
// ------------------------------------------------------------------

describe('<NotificationItem /> — temps relatif', () => {
  it('< 5 s → "à l\'instant"', () => {
    renderWithRouter(
      <NotificationItem
        notification={makeBadgeNotif({
          created_at: new Date(NOW - 2_000).toISOString(),
        })}
        onMarkAsRead={vi.fn()}
      />,
    );
    expect(
      screen.getByText(i18n.t('notifications.time.justNow')),
    ).toBeInTheDocument();
  });

  it('quelques minutes → "il y a X min"', () => {
    renderWithRouter(
      <NotificationItem
        notification={makeBadgeNotif({
          created_at: new Date(NOW - 5 * 60 * 1000).toISOString(),
        })}
        onMarkAsRead={vi.fn()}
      />,
    );
    // Pluralisation i18next : 5 min
    expect(screen.getByText(/il y a\s*5\s*min/i)).toBeInTheDocument();
  });

  it('quelques heures → "il y a X h"', () => {
    renderWithRouter(
      <NotificationItem
        notification={makeBadgeNotif({
          created_at: new Date(NOW - 3 * 60 * 60 * 1000).toISOString(),
        })}
        onMarkAsRead={vi.fn()}
      />,
    );
    expect(screen.getByText(/il y a\s*3\s*h/i)).toBeInTheDocument();
  });

  it('quelques jours → "il y a X j"', () => {
    renderWithRouter(
      <NotificationItem
        notification={makeBadgeNotif({
          created_at: new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString(),
        })}
        onMarkAsRead={vi.fn()}
      />,
    );
    expect(screen.getByText(/il y a\s*2\s*j/i)).toBeInTheDocument();
  });
});

// ------------------------------------------------------------------
//  Dot non-lue
// ------------------------------------------------------------------

describe('<NotificationItem /> — indicateur non-lue', () => {
  it('affiche le dot quand read_at=null', () => {
    renderWithRouter(
      <NotificationItem
        notification={makeBadgeNotif({ read_at: null })}
        onMarkAsRead={vi.fn()}
      />,
    );
    expect(
      screen.getByLabelText(i18n.t('notifications.item.unreadDot')),
    ).toBeInTheDocument();
  });

  it('masque le dot quand read_at est rempli', () => {
    renderWithRouter(
      <NotificationItem
        notification={makeBadgeNotif({ read_at: '2026-04-21T11:00:00Z' })}
        onMarkAsRead={vi.fn()}
      />,
    );
    expect(
      screen.queryByLabelText(i18n.t('notifications.item.unreadDot')),
    ).not.toBeInTheDocument();
  });
});

// ------------------------------------------------------------------
//  Click : mark-as-read + navigation
// ------------------------------------------------------------------

describe('<NotificationItem /> — click', () => {
  it('click sur une notif non lue : appelle onMarkAsRead(id)', () => {
    const onMark = vi.fn();
    renderWithRouter(
      <NotificationItem
        notification={makeBadgeNotif()}
        onMarkAsRead={onMark}
      />,
    );
    const button = screen.getByRole('button');
    act(() => {
      button.click();
    });
    expect(onMark).toHaveBeenCalledWith(UUID_A);
  });

  it('click sur une notif déjà lue : pas d\'appel à onMarkAsRead', () => {
    const onMark = vi.fn();
    renderWithRouter(
      <NotificationItem
        notification={makeBadgeNotif({ read_at: '2026-04-21T10:00:00Z' })}
        onMarkAsRead={onMark}
      />,
    );
    const button = screen.getByRole('button');
    act(() => {
      button.click();
    });
    expect(onMark).not.toHaveBeenCalled();
  });

  it('click appelle onNavigate (fermeture pop-up)', () => {
    const onNav = vi.fn();
    renderWithRouter(
      <NotificationItem
        notification={makeBadgeNotif()}
        onMarkAsRead={vi.fn()}
        onNavigate={onNav}
      />,
    );
    act(() => {
      screen.getByRole('button').click();
    });
    expect(onNav).toHaveBeenCalled();
  });

  it('badge_earned navigue vers /app/profile', () => {
    renderWithRouter(
      <NotificationItem
        notification={makeBadgeNotif()}
        onMarkAsRead={vi.fn()}
      />,
    );
    act(() => {
      screen.getByRole('button').click();
    });
    expect(screen.getByTestId('loc').textContent).toBe('/app/profile');
  });

  it('concours_new_member navigue vers /app/concours/:id', () => {
    const notif: Notification = {
      id: UUID_A,
      user_id: UUID_B,
      type: 'concours_new_member',
      title: null,
      body: null,
      payload: {
        concours_id: UUID_C,
        concours_nom: 'X',
        new_user_id: UUID_A,
      },
      read_at: null,
      created_at: '2026-04-21T11:59:00Z',
    };
    renderWithRouter(
      <NotificationItem notification={notif} onMarkAsRead={vi.fn()} />,
    );
    act(() => {
      screen.getByRole('button').click();
    });
    expect(screen.getByTestId('loc').textContent).toBe(
      `/app/concours/${UUID_C}`,
    );
  });

  it('chat_mention navigue vers /app/concours/:id/chat', () => {
    const notif: Notification = {
      id: UUID_A,
      user_id: UUID_B,
      type: 'chat_mention',
      title: null,
      body: null,
      payload: {
        concours_id: UUID_C,
        message_id: UUID_A,
        mentioned_by: UUID_B,
        token: 'Alice',
        match_type: 'first_name',
        body_preview: 'hey',
      },
      read_at: null,
      created_at: '2026-04-21T11:59:00Z',
    };
    renderWithRouter(
      <NotificationItem notification={notif} onMarkAsRead={vi.fn()} />,
    );
    act(() => {
      screen.getByRole('button').click();
    });
    expect(screen.getByTestId('loc').textContent).toBe(
      `/app/concours/${UUID_C}/chat`,
    );
  });
});
