import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConcoursChatPage } from '@/features/chat/concours-chat-page';
import type { MessagesInfiniteData } from '@/features/chat/use-chat';
import { i18n } from '@/i18n';

/**
 * Tests de rendu de `<ConcoursChatPage />`.
 *
 * On mocke :
 *   - `use-chat` : on pilote `useMessagesInfiniteQuery` + on remplace
 *     `useChatRealtime` par un spy, et on capture les appels de la
 *     mutation d'envoi.
 *   - `use-concours` : pilote le concours (isMember).
 *   - `@/hooks/use-auth` : user fixe.
 *   - `sonner` : toasts muets.
 *
 * Invariants couverts :
 *   - Guards : redirect liste si concours introuvable, redirect fiche
 *     si l'user n'est pas membre.
 *   - Rendu : titre + nom du concours + CTAs vers pronos/classement.
 *   - Realtime hook appelé avec le concoursId courant quand membre.
 *   - État erreur messagesQuery → affiche le message loadFailed.
 */

const CONCOURS = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const USER = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

// ---- Hoisted mocks ----

const mocks = vi.hoisted(() => {
  return {
    detailState: {
      isLoading: false,
      isError: false,
      data: null as
        | {
            id: string;
            nom: string;
            competition: { nom: string } | null;
            participants: Array<{ user_id: string }>;
          }
        | null,
    },
    messagesState: {
      data: undefined as MessagesInfiniteData | undefined,
      isLoading: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPageSpy: vi.fn(),
    },
    realtimeSpy: vi.fn(),
    mutateAsyncSpy: vi.fn(),
  };
});

vi.mock('@/features/concours/use-concours', () => ({
  useConcoursDetailQuery: () => ({
    isLoading: mocks.detailState.isLoading,
    isError: mocks.detailState.isError,
    data: mocks.detailState.data,
  }),
}));

vi.mock('@/features/chat/use-chat', async () => {
  // On préserve `flattenMessagesAsc` (helper pur) — les hooks sont
  // remplacés par des stubs pilotés par `mocks.*`.
  const actual = (await vi.importActual(
    '@/features/chat/use-chat',
  )) as Record<string, unknown>;
  return {
    ...actual,
    useMessagesInfiniteQuery: () => ({
      data: mocks.messagesState.data,
      isLoading: mocks.messagesState.isLoading,
      isError: mocks.messagesState.isError,
      hasNextPage: mocks.messagesState.hasNextPage,
      isFetchingNextPage: mocks.messagesState.isFetchingNextPage,
      fetchNextPage: mocks.messagesState.fetchNextPageSpy,
    }),
    useChatRealtime: (
      concoursId: string | undefined,
      options: { enabled?: boolean } = {},
    ) => {
      mocks.realtimeSpy(concoursId, options);
    },
    useSendMessageMutation: () => ({
      mutateAsync: mocks.mutateAsyncSpy,
      isPending: false,
    }),
  };
});

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: USER } }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Note : les `vi.mock` ci-dessus sont hoistés par Vitest au-dessus des
// `import` de fichiers mockés, donc l'import de `ConcoursChatPage` en
// haut du fichier reçoit bien la version mockée de `use-chat`.

// ---- Helpers ----

const renderPage = (path = `/app/concours/${CONCOURS}/chat`) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/app/concours/:id/chat"
          element={<ConcoursChatPage />}
        />
        <Route path="/app/concours/:id" element={<div>concours-fiche</div>} />
        <Route path="/app/concours" element={<div>concours-liste</div>} />
      </Routes>
    </MemoryRouter>,
  );

const setConcours = (isMember: boolean) => {
  mocks.detailState.isLoading = false;
  mocks.detailState.isError = false;
  mocks.detailState.data = {
    id: CONCOURS,
    nom: 'Pronos entre potes',
    competition: { nom: 'WC 2026' },
    participants: isMember
      ? [{ user_id: USER }, { user_id: OTHER }]
      : [{ user_id: OTHER }],
  };
};

beforeAll(async () => {
  await i18n.changeLanguage('fr');
});

beforeEach(() => {
  mocks.detailState.isLoading = false;
  mocks.detailState.isError = false;
  mocks.detailState.data = null;
  mocks.messagesState.data = undefined;
  mocks.messagesState.isLoading = false;
  mocks.messagesState.isError = false;
  mocks.messagesState.hasNextPage = false;
  mocks.messagesState.isFetchingNextPage = false;
  mocks.messagesState.fetchNextPageSpy.mockReset();
  mocks.realtimeSpy.mockReset();
  mocks.mutateAsyncSpy.mockReset();
});

// ------------------------------------------------------------------
//  Guards
// ------------------------------------------------------------------

describe('<ConcoursChatPage /> guards', () => {
  it('redirige vers la liste si le concours est introuvable (error)', () => {
    mocks.detailState.isError = true;
    mocks.detailState.data = null;
    renderPage();
    expect(screen.getByText('concours-liste')).toBeInTheDocument();
  });

  it("redirige vers la fiche si l'utilisateur n'est pas membre", () => {
    setConcours(false);
    renderPage();
    expect(screen.getByText('concours-fiche')).toBeInTheDocument();
  });
});

// ------------------------------------------------------------------
//  Rendu
// ------------------------------------------------------------------

describe('<ConcoursChatPage /> rendu', () => {
  it('affiche le titre + le nom du concours + la compétition', () => {
    setConcours(true);
    renderPage();
    expect(
      screen.getByRole('heading', { name: new RegExp(i18n.t('chat.title'), 'i') }),
    ).toBeInTheDocument();
    expect(screen.getByText(/pronos entre potes/i)).toBeInTheDocument();
    expect(screen.getByText(/wc 2026/i)).toBeInTheDocument();
  });

  it('affiche les CTAs "Voir les pronos" et "Voir le classement"', () => {
    setConcours(true);
    renderPage();
    expect(
      screen.getByRole('link', {
        name: new RegExp(i18n.t('chat.goToPronos'), 'i'),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: new RegExp(i18n.t('chat.goToClassement'), 'i'),
      }),
    ).toBeInTheDocument();
  });

  it('affiche le bouton retour vers la fiche concours', () => {
    setConcours(true);
    renderPage();
    expect(
      screen.getByRole('link', {
        name: new RegExp(i18n.t('chat.backToConcours'), 'i'),
      }),
    ).toBeInTheDocument();
  });

  it("affiche l'empty state quand il n'y a pas de message", () => {
    setConcours(true);
    mocks.messagesState.data = undefined;
    renderPage();
    expect(screen.getByText(i18n.t('chat.empty.title'))).toBeInTheDocument();
  });

  it('affiche le message loadFailed quand messagesQuery.isError=true', () => {
    setConcours(true);
    mocks.messagesState.isError = true;
    renderPage();
    expect(
      screen.getByText(i18n.t('chat.errors.loadFailed')),
    ).toBeInTheDocument();
  });

  it('appelle useChatRealtime avec le concoursId + enabled=true quand membre', () => {
    setConcours(true);
    renderPage();
    expect(mocks.realtimeSpy).toHaveBeenCalledWith(CONCOURS, {
      enabled: true,
    });
  });
});
