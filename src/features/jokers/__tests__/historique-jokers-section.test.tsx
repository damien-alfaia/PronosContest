import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserJokerHistoryRow } from '@/features/jokers/api';
import { HistoriqueJokersSection } from '@/features/jokers/historique-jokers-section';
import { i18n } from '@/i18n';

/**
 * Tests de rendu de `<HistoriqueJokersSection />` (Sprint 8.C.3).
 *
 * Mocks :
 *   - `use-jokers` : on pilote `useUserJokersHistoryQuery` depuis un
 *     state partagé (vi.hoisted).
 *
 * Invariants couverts :
 *   - titre + progression "{{owned}} actif(s) · {{used}} utilisé(s) · {{total}} au total",
 *   - états loading / error / empty / normal,
 *   - tri par activité la plus récente (used_at ?? acquired_at desc),
 *   - lien vers la fiche concours correctement composé,
 *   - badge statut (Actif / Utilisé).
 */

const USER = '11111111-1111-1111-1111-111111111111';
const CONCOURS_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CONCOURS_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const mocks = vi.hoisted(() => {
  return {
    historyState: {
      data: [] as UserJokerHistoryRow[] | undefined,
      isLoading: false,
      isError: false,
    },
  };
});

vi.mock('@/features/jokers/use-jokers', () => ({
  useUserJokersHistoryQuery: () => ({
    data: mocks.historyState.data,
    isLoading: mocks.historyState.isLoading,
    isError: mocks.historyState.isError,
  }),
}));

// ------------------------------------------------------------------
//  Factories
// ------------------------------------------------------------------

const validLocalized = { fr: 'Libellé', en: 'Label' };

const makeRow = (
  over: Partial<UserJokerHistoryRow> & {
    id: string;
    joker_code: string;
    concoursId?: string;
    concoursNom?: string;
    libelle?: { fr: string; en: string };
  },
): UserJokerHistoryRow => {
  const {
    libelle,
    concoursId,
    concoursNom,
    ...rest
  } = over;
  const jokerLibelle = libelle ?? validLocalized;
  return {
    id: rest.id,
    user_id: USER,
    concours_id: concoursId ?? CONCOURS_A,
    joker_code: rest.joker_code,
    acquired_from: 'starter',
    acquired_at: '2026-04-22T10:00:00Z',
    used_at: null,
    used_on_match_id: null,
    used_on_target_user_id: null,
    used_payload: null,
    joker: {
      code: rest.joker_code,
      category: 'boost',
      libelle: jokerLibelle,
      description: validLocalized,
      icon: 'Flame',
      sort_order: 10,
    },
    concours: {
      id: concoursId ?? CONCOURS_A,
      nom: concoursNom ?? 'Concours A',
    },
    ...rest,
  };
};

const renderSection = (userId: string | undefined = USER) =>
  render(
    <MemoryRouter>
      <HistoriqueJokersSection userId={userId} />
    </MemoryRouter>,
  );

// ------------------------------------------------------------------
//  Setup
// ------------------------------------------------------------------

beforeAll(async () => {
  await i18n.changeLanguage('fr');
});

beforeEach(() => {
  mocks.historyState.data = [];
  mocks.historyState.isLoading = false;
  mocks.historyState.isError = false;
});

// ------------------------------------------------------------------
//  Tests
// ------------------------------------------------------------------

describe('<HistoriqueJokersSection />', () => {
  it('affiche le titre "Historique des jokers"', () => {
    renderSection();
    expect(screen.getByText(/historique des jokers/i)).toBeInTheDocument();
  });

  it('affiche la progression "X actif(s) · Y utilisé(s) · Z au total"', () => {
    mocks.historyState.data = [
      makeRow({ id: 'a', joker_code: 'double' }),
      makeRow({ id: 'b', joker_code: 'triple' }),
      makeRow({
        id: 'c',
        joker_code: 'gift',
        used_at: '2026-04-25T12:00:00Z',
      }),
    ];

    renderSection();
    // 2 actifs · 1 utilisé · 3 au total
    expect(
      screen.getByText(/2\s*actif.*·\s*1\s*utilis.*·\s*3\s*au total/i),
    ).toBeInTheDocument();
  });

  it('état loading : affiche le texte de chargement', () => {
    mocks.historyState.isLoading = true;
    renderSection();
    expect(screen.getByText(/chargement de l'historique/i)).toBeInTheDocument();
  });

  it('état error : affiche le message d erreur', () => {
    mocks.historyState.isError = true;
    renderSection();
    expect(
      screen.getByText(/impossible de charger l'historique/i),
    ).toBeInTheDocument();
  });

  it('état empty : aucun slot → message dédié', () => {
    mocks.historyState.data = [];
    renderSection();
    expect(screen.getByText(/pas encore de jokers/i)).toBeInTheDocument();
  });

  it('état normal : rend un item par slot', () => {
    mocks.historyState.data = [
      makeRow({ id: 'a', joker_code: 'double' }),
      makeRow({ id: 'b', joker_code: 'triple' }),
    ];

    renderSection();
    const list = screen.getByRole('list', {
      name: /historique des jokers/i,
    });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  });

  it('tri : activité la plus récente en premier (used_at ?? acquired_at desc)', () => {
    mocks.historyState.data = [
      // used il y a longtemps
      makeRow({
        id: 'old-used',
        joker_code: 'double',
        libelle: { fr: 'Ancien utilisé', en: 'Old used' },
        used_at: '2026-04-20T10:00:00Z',
      }),
      // owned plus récent
      makeRow({
        id: 'recent-owned',
        joker_code: 'triple',
        libelle: { fr: 'Récent actif', en: 'Recent owned' },
        acquired_at: '2026-04-30T10:00:00Z',
      }),
      // used plus récent que tout
      makeRow({
        id: 'recent-used',
        joker_code: 'gift',
        libelle: { fr: 'Récent utilisé', en: 'Recent used' },
        acquired_at: '2026-04-25T10:00:00Z',
        used_at: '2026-05-01T10:00:00Z',
      }),
    ];

    renderSection();
    const items = screen.getAllByRole('listitem');
    // Ordre attendu : recent-used → recent-owned → old-used
    expect(items[0]?.getAttribute('data-category')).toBe('boost');
    expect(within(items[0]!).getByText('Récent utilisé')).toBeInTheDocument();
    expect(within(items[1]!).getByText('Récent actif')).toBeInTheDocument();
    expect(within(items[2]!).getByText('Ancien utilisé')).toBeInTheDocument();
  });

  it('lien concours : href vers /app/concours/:id avec le nom', () => {
    mocks.historyState.data = [
      makeRow({
        id: 'a',
        joker_code: 'double',
        concoursId: CONCOURS_B,
        concoursNom: 'Ligue des champions',
      }),
    ];

    renderSection();
    const link = screen.getByRole('link', { name: /ligue des champions/i });
    expect(link).toHaveAttribute('href', `/app/concours/${CONCOURS_B}`);
  });

  it('badge statut "Actif" pour un slot owned, "Utilisé" sinon', () => {
    mocks.historyState.data = [
      makeRow({ id: 'owned', joker_code: 'double' }),
      makeRow({
        id: 'used',
        joker_code: 'triple',
        used_at: '2026-04-25T12:00:00Z',
      }),
    ];

    renderSection();
    expect(screen.getByText('Actif')).toBeInTheDocument();
    expect(screen.getByText('Utilisé')).toBeInTheDocument();
  });

  it('data-owned sur les <li> reflète le statut du slot', () => {
    mocks.historyState.data = [
      makeRow({
        id: 'used',
        joker_code: 'gift',
        used_at: '2026-04-25T12:00:00Z',
      }),
      makeRow({ id: 'owned', joker_code: 'double' }),
    ];

    renderSection();
    const items = screen.getAllByRole('listitem');
    // used a été utilisé plus récemment que le owned qui a été acquis avant
    // (acquired_at = 2026-04-22 < used_at = 2026-04-25) → used en premier.
    expect(items[0]?.getAttribute('data-owned')).toBe('false');
    expect(items[1]?.getAttribute('data-owned')).toBe('true');
  });

  it('userId undefined : la query est désactivée côté hook (enabled:false) mais le rendu reste stable', () => {
    // Le hook mocké retourne data=[] donc la section rend l'empty state.
    renderSection(undefined);
    expect(screen.getByText(/historique des jokers/i)).toBeInTheDocument();
    expect(screen.getByText(/pas encore de jokers/i)).toBeInTheDocument();
  });
});
