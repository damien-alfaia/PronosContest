import { render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LandingStats } from '@/features/landing/api';
import { SocialProofStrip } from '@/features/landing/social-proof-strip';
import { i18n } from '@/i18n';

/**
 * Tests de rendu du composant `<SocialProofStrip />`.
 *
 * On mock `useLandingStatsQuery` via `vi.hoisted()` pour piloter les
 * états loading / error / empty / normal depuis chaque test.
 *
 * Invariants couverts :
 *   - loading : skeleton visible (3 placeholders), pas de texte i18n
 *   - error   : rien n'est rendu (fallback silencieux)
 *   - empty (0/0/0) : rien n'est rendu
 *   - normal : 3 stats avec labels i18n + chiffres formatés
 *   - role="list" + role="listitem" pour l'accessibilité
 */

const mocks = vi.hoisted(() => {
  return {
    state: {
      data: undefined as LandingStats | undefined,
      isLoading: false,
      isError: false,
    },
  };
});

vi.mock('@/features/landing/use-landing-stats', () => ({
  useLandingStatsQuery: () => ({
    data: mocks.state.data,
    isLoading: mocks.state.isLoading,
    isError: mocks.state.isError,
  }),
  landingKeys: {
    all: ['landing'] as const,
    stats: () => ['landing', 'stats'] as const,
  },
}));

beforeAll(async () => {
  await i18n.changeLanguage('fr');
});

beforeEach(() => {
  mocks.state = { data: undefined, isLoading: false, isError: false };
});

describe('<SocialProofStrip />', () => {
  it('affiche un skeleton pendant le loading', () => {
    mocks.state = { data: undefined, isLoading: true, isError: false };

    const { container } = render(<SocialProofStrip />);

    // 3 placeholders .animate-pulse
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses).toHaveLength(3);
    // Pas de texte i18n de stat
    expect(
      screen.queryByText(i18n.t('landing.socialProof.concoursLabel')),
    ).not.toBeInTheDocument();
  });

  it("ne rend rien en cas d'erreur (fallback silencieux)", () => {
    mocks.state = { data: undefined, isLoading: false, isError: true };

    const { container } = render(<SocialProofStrip />);

    expect(container.firstChild).toBeNull();
  });

  it('ne rend rien si toutes les stats sont à 0 (empty guard)', () => {
    mocks.state = {
      data: { nbConcours: 0, nbPronos: 0, nbUsers: 0 },
      isLoading: false,
      isError: false,
    };

    const { container } = render(<SocialProofStrip />);

    expect(container.firstChild).toBeNull();
  });

  it('rend les 3 stats avec labels i18n + chiffres formatés', () => {
    mocks.state = {
      data: { nbConcours: 42, nbPronos: 1337, nbUsers: 128 },
      isLoading: false,
      isError: false,
    };

    render(<SocialProofStrip />);

    // Chiffres formatés FR (1 337 avec espace insécable — tabular-nums).
    // On ne teste pas le caractère exact de séparateur (dépend du locale),
    // on teste juste que les trois valeurs sont présentes.
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText(/1.?337/)).toBeInTheDocument(); // accepte "1 337" ou "1,337"
    expect(screen.getByText('128')).toBeInTheDocument();

    // Labels i18n
    expect(
      screen.getByText(i18n.t('landing.socialProof.concoursLabel')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('landing.socialProof.pronosLabel')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('landing.socialProof.usersLabel')),
    ).toBeInTheDocument();
  });

  it('a un role="list" + aria-label sur le conteneur quand rendu', () => {
    mocks.state = {
      data: { nbConcours: 10, nbPronos: 20, nbUsers: 5 },
      isLoading: false,
      isError: false,
    };

    render(<SocialProofStrip />);

    const list = screen.getByRole('list');
    expect(list).toHaveAttribute(
      'aria-label',
      i18n.t('landing.socialProof.ariaLabel'),
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});
