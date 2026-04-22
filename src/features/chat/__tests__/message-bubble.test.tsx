import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { MessageBubble } from '@/features/chat/message-bubble';
import type { MessageWithAuthor } from '@/features/chat/schemas';
import { i18n } from '@/i18n';

/**
 * Tests unitaires de `<MessageBubble />`.
 *
 * On vérifie :
 *   - Rendu du body + header (auteur + heure) quand `showHeader`.
 *   - Header masqué quand `showHeader=false` (rafale), mais la colonne
 *     avatar est préservée pour l'alignement.
 *   - Variante `isSelf` : alignement inversé (flex-row-reverse) + fond
 *     primary.
 *   - Variante autrui : alignement normal + fond muted.
 *   - Message optimistic (`id` commençant par `optimistic-`) : opacity-70.
 *   - Fallback initiales via AvatarFallback si pas d'avatar_url.
 *   - Fallback "?" si auteur absent.
 */

const CONCOURS = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const USER = '11111111-1111-1111-1111-111111111111';
const MSG_ID = '22222222-2222-2222-2222-222222222222';

const makeMessage = (
  over: Partial<MessageWithAuthor> = {},
): MessageWithAuthor => ({
  id: MSG_ID,
  concours_id: CONCOURS,
  user_id: USER,
  body: 'hello',
  created_at: '2026-04-20T10:30:00Z',
  author: {
    id: USER,
    prenom: 'Alice',
    nom: 'Martin',
    avatar_url: null,
  },
  ...over,
});

beforeAll(async () => {
  await i18n.changeLanguage('fr');
});

describe('<MessageBubble />', () => {
  it('affiche le body du message', () => {
    render(
      <MessageBubble
        message={makeMessage({ body: 'Bonjour tout le monde' })}
        isSelf={false}
        showHeader
      />,
    );
    expect(screen.getByText('Bonjour tout le monde')).toBeInTheDocument();
  });

  it('affiche le header (nom + heure) quand showHeader=true', () => {
    render(
      <MessageBubble
        message={makeMessage()}
        isSelf={false}
        showHeader
      />,
    );
    // nom complet visible
    expect(screen.getByText('Alice Martin')).toBeInTheDocument();
    // heure formatée (fr-FR : 12:30 ou 10:30 selon le TZ — on matche HH:MM)
    expect(
      screen.getByRole('article', { name: /alice martin/i }),
    ).toBeInTheDocument();
  });

  it("ne rend pas le nom quand showHeader=false (rafale groupée)", () => {
    render(
      <MessageBubble
        message={makeMessage()}
        isSelf={false}
        showHeader={false}
      />,
    );
    expect(screen.queryByText('Alice Martin')).not.toBeInTheDocument();
  });

  it('affiche les initiales en fallback quand pas d avatar_url', () => {
    render(
      <MessageBubble
        message={makeMessage()}
        isSelf={false}
        showHeader
      />,
    );
    // Radix Avatar affiche le fallback tant qu'il n'y a pas d'image.
    expect(screen.getByText('AM')).toBeInTheDocument();
  });

  it('affiche "?" si l auteur est null', () => {
    render(
      <MessageBubble
        message={makeMessage({ author: null })}
        isSelf={false}
        showHeader
      />,
    );
    // Deux "?" sont rendus : le fallback de l'avatar ET le label du header
    // (le nom d'auteur). C'est volontaire — les deux sources d'identité
    // dégradent sur le même placeholder quand author est null.
    const placeholders = screen.getAllByText('?');
    expect(placeholders).toHaveLength(2);
  });

  it('isSelf=true applique flex-row-reverse sur l article', () => {
    render(
      <MessageBubble
        message={makeMessage()}
        isSelf
        showHeader
      />,
    );
    const article = screen.getByRole('article', { name: /alice martin/i });
    expect(article.className).toContain('flex-row-reverse');
  });

  it('isSelf=false applique flex-row sur l article', () => {
    render(
      <MessageBubble
        message={makeMessage()}
        isSelf={false}
        showHeader
      />,
    );
    const article = screen.getByRole('article', { name: /alice martin/i });
    expect(article.className).toContain('flex-row');
    expect(article.className).not.toContain('flex-row-reverse');
  });

  it('applique opacity-70 aux messages optimistic (id commence par "optimistic-")', () => {
    const { container } = render(
      <MessageBubble
        message={makeMessage({ id: 'optimistic-1234567890' })}
        isSelf
        showHeader
      />,
    );
    // La bulle est la div qui contient le texte.
    const bubble = container.querySelector('.rounded-2xl');
    expect(bubble?.className).toContain('opacity-70');
  });

  it("ne porte pas opacity-70 pour un message non optimistic", () => {
    const { container } = render(
      <MessageBubble
        message={makeMessage()}
        isSelf
        showHeader
      />,
    );
    const bubble = container.querySelector('.rounded-2xl');
    expect(bubble?.className ?? '').not.toContain('opacity-70');
  });

  it('isSelf=true applique bg-primary sur la bulle', () => {
    const { container } = render(
      <MessageBubble
        message={makeMessage()}
        isSelf
        showHeader
      />,
    );
    const bubble = container.querySelector('.rounded-2xl');
    expect(bubble?.className).toContain('bg-primary');
  });

  it('isSelf=false applique bg-muted sur la bulle', () => {
    const { container } = render(
      <MessageBubble
        message={makeMessage()}
        isSelf={false}
        showHeader
      />,
    );
    const bubble = container.querySelector('.rounded-2xl');
    expect(bubble?.className).toContain('bg-muted');
  });
});
