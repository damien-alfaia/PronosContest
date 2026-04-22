import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { MessageList } from '@/features/chat/message-list';
import type { MessageWithAuthor } from '@/features/chat/schemas';
import { i18n } from '@/i18n';

/**
 * Tests unitaires de `<MessageList />`.
 *
 * On vérifie :
 *   - État initial (loading) : spinner + texte de chargement.
 *   - État vide (pas loading, pas de messages) : empty state dédié.
 *   - Rendu d'une liste de messages : chaque bulle rend le body.
 *   - Bouton "Charger plus ancien" affiché si `hasNextPage=true`,
 *     caché sinon ; label "Aucun message plus ancien" quand on a tout.
 *   - Groupage par rafale : 2 messages consécutifs du même auteur dans
 *     les 5 min → un seul header (le 2e rend SANS le nom).
 *   - Groupage rompu par un écart de 5 min → chaque message a son header.
 *   - Groupage rompu par changement d'auteur → chaque message a son header.
 */

const CONCOURS = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

const makeMsg = (over: Partial<MessageWithAuthor> = {}): MessageWithAuthor => ({
  id: over.id ?? 'a0000000-0000-0000-0000-000000000001',
  concours_id: CONCOURS,
  user_id: USER_A,
  body: 'hello',
  created_at: '2026-04-20T10:00:00Z',
  author: {
    id: USER_A,
    prenom: 'Alice',
    nom: 'Martin',
    avatar_url: null,
  },
  ...over,
});

beforeAll(async () => {
  await i18n.changeLanguage('fr');
});

describe('<MessageList />', () => {
  it('état initial loading : affiche un spinner + texte de chargement', () => {
    render(
      <MessageList
        messages={[]}
        selfUserId={USER_A}
        hasNextPage={false}
        isFetchingNextPage={false}
        isInitialLoading
        onLoadOlder={vi.fn()}
      />,
    );
    expect(screen.getByText(i18n.t('chat.loading'))).toBeInTheDocument();
  });

  it('état vide : affiche le titre + description du empty state', () => {
    render(
      <MessageList
        messages={[]}
        selfUserId={USER_A}
        hasNextPage={false}
        isFetchingNextPage={false}
        isInitialLoading={false}
        onLoadOlder={vi.fn()}
      />,
    );
    expect(screen.getByText(i18n.t('chat.empty.title'))).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('chat.empty.description')),
    ).toBeInTheDocument();
  });

  it('affiche le bouton "Charger plus ancien" quand hasNextPage=true', () => {
    render(
      <MessageList
        messages={[makeMsg({ id: 'a0000000-0000-0000-0000-000000000001' })]}
        selfUserId={USER_A}
        hasNextPage
        isFetchingNextPage={false}
        isInitialLoading={false}
        onLoadOlder={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: new RegExp(i18n.t('chat.loadOlder'), 'i') }),
    ).toBeInTheDocument();
  });

  it('affiche "Aucun message plus ancien" quand hasNextPage=false et qu il y a des messages', () => {
    render(
      <MessageList
        messages={[makeMsg({ id: 'a0000000-0000-0000-0000-000000000001' })]}
        selfUserId={USER_A}
        hasNextPage={false}
        isFetchingNextPage={false}
        isInitialLoading={false}
        onLoadOlder={vi.fn()}
      />,
    );
    expect(
      screen.getByText(i18n.t('chat.noMoreMessages')),
    ).toBeInTheDocument();
  });

  it("rend le body de chaque message", () => {
    const messages = [
      makeMsg({
        id: 'a0000000-0000-0000-0000-000000000001',
        body: 'Premier',
      }),
      makeMsg({
        id: 'a0000000-0000-0000-0000-000000000002',
        body: 'Deuxième',
        created_at: '2026-04-20T10:01:00Z',
      }),
    ];

    render(
      <MessageList
        messages={messages}
        selfUserId={USER_A}
        hasNextPage={false}
        isFetchingNextPage={false}
        isInitialLoading={false}
        onLoadOlder={vi.fn()}
      />,
    );
    expect(screen.getByText('Premier')).toBeInTheDocument();
    expect(screen.getByText('Deuxième')).toBeInTheDocument();
  });

  it("groupage : 2 messages du même auteur à < 5 min → 1 seul header", () => {
    const messages = [
      makeMsg({
        id: 'a0000000-0000-0000-0000-000000000001',
        body: 'Un',
        created_at: '2026-04-20T10:00:00Z',
      }),
      makeMsg({
        id: 'a0000000-0000-0000-0000-000000000002',
        body: 'Deux',
        created_at: '2026-04-20T10:02:00Z', // +2 min
      }),
    ];

    render(
      <MessageList
        messages={messages}
        selfUserId={USER_A}
        hasNextPage={false}
        isFetchingNextPage={false}
        isInitialLoading={false}
        onLoadOlder={vi.fn()}
      />,
    );
    // Le nom "Alice Martin" apparaît une seule fois (header du 1er seulement)
    const mentions = screen.getAllByText('Alice Martin');
    expect(mentions).toHaveLength(1);
  });

  it("groupage rompu : 2 messages du même auteur à > 5 min → 2 headers", () => {
    const messages = [
      makeMsg({
        id: 'a0000000-0000-0000-0000-000000000001',
        body: 'Un',
        created_at: '2026-04-20T10:00:00Z',
      }),
      makeMsg({
        id: 'a0000000-0000-0000-0000-000000000002',
        body: 'Deux',
        created_at: '2026-04-20T10:10:00Z', // +10 min
      }),
    ];

    render(
      <MessageList
        messages={messages}
        selfUserId={USER_A}
        hasNextPage={false}
        isFetchingNextPage={false}
        isInitialLoading={false}
        onLoadOlder={vi.fn()}
      />,
    );
    const mentions = screen.getAllByText('Alice Martin');
    expect(mentions).toHaveLength(2);
  });

  it("groupage rompu par changement d'auteur → header pour chaque bulle", () => {
    const messages = [
      makeMsg({
        id: 'a0000000-0000-0000-0000-000000000001',
        body: 'Un',
        user_id: USER_A,
        author: {
          id: USER_A,
          prenom: 'Alice',
          nom: 'Martin',
          avatar_url: null,
        },
      }),
      makeMsg({
        id: 'a0000000-0000-0000-0000-000000000002',
        body: 'Deux',
        user_id: USER_B,
        created_at: '2026-04-20T10:00:30Z',
        author: {
          id: USER_B,
          prenom: 'Bob',
          nom: 'Dupont',
          avatar_url: null,
        },
      }),
    ];

    render(
      <MessageList
        messages={messages}
        selfUserId={USER_A}
        hasNextPage={false}
        isFetchingNextPage={false}
        isInitialLoading={false}
        onLoadOlder={vi.fn()}
      />,
    );
    expect(screen.getByText('Alice Martin')).toBeInTheDocument();
    expect(screen.getByText('Bob Dupont')).toBeInTheDocument();
  });
});
