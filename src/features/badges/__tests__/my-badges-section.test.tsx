import { render, screen, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { MyBadgesSection } from '@/features/badges/my-badges-section';
import type {
  BadgeCatalogRow,
  UserBadgeWithCatalog,
} from '@/features/badges/schemas';
import { i18n } from '@/i18n';

/**
 * Tests de rendu de `<MyBadgesSection />`.
 *
 * Mocks :
 *   - `use-badges` : on pilote `useBadgesCatalogQuery` + `useUserBadgesQuery`
 *     depuis un state partagé (vi.hoisted), et on remplace `useUserBadgesRealtime`
 *     par un spy pour vérifier qu'il est bien appelé avec le userId courant.
 *
 * Invariants couverts :
 *   - titre + progress "{{earned}} / {{total}} débloqués",
 *   - états loading / error / empty / normal,
 *   - tri : gagnés avant non-gagnés ; chez les gagnés tier desc (legendary
 *     d'abord), chez les non-gagnés tier asc (bronze d'abord),
 *   - Realtime appelé avec le bon userId.
 */

const USER = '11111111-1111-1111-1111-111111111111';

const mocks = vi.hoisted(() => {
  return {
    catalogState: {
      data: [] as BadgeCatalogRow[] | undefined,
      isLoading: false,
      isError: false,
    },
    userState: {
      data: [] as UserBadgeWithCatalog[] | undefined,
      isLoading: false,
      isError: false,
    },
    realtimeSpy: vi.fn(),
  };
});

vi.mock('@/features/badges/use-badges', () => ({
  useBadgesCatalogQuery: () => ({
    data: mocks.catalogState.data,
    isLoading: mocks.catalogState.isLoading,
    isError: mocks.catalogState.isError,
  }),
  useUserBadgesQuery: () => ({
    data: mocks.userState.data,
    isLoading: mocks.userState.isLoading,
    isError: mocks.userState.isError,
  }),
  useUserBadgesRealtime: (userId: string | undefined) => {
    mocks.realtimeSpy(userId);
  },
}));

// ------------------------------------------------------------------
//  Factories
// ------------------------------------------------------------------

const validLocalized = { fr: 'Libellé', en: 'Label' };

const makeBadge = (over: Partial<BadgeCatalogRow> = {}): BadgeCatalogRow => ({
  code: 'x',
  category: 'skill',
  tier: 'silver',
  libelle: validLocalized,
  description: validLocalized,
  icon: 'Target',
  sort_order: 0,
  ...over,
});

const makeUB = (
  over: Partial<UserBadgeWithCatalog> & { badge_code: string; badge: BadgeCatalogRow },
): UserBadgeWithCatalog => ({
  user_id: USER,
  earned_at: '2026-04-20T12:00:00Z',
  metadata: {},
  ...over,
});

// ------------------------------------------------------------------
//  Setup
// ------------------------------------------------------------------

beforeAll(async () => {
  await i18n.changeLanguage('fr');
});

beforeEach(() => {
  mocks.catalogState.data = [];
  mocks.catalogState.isLoading = false;
  mocks.catalogState.isError = false;
  mocks.userState.data = [];
  mocks.userState.isLoading = false;
  mocks.userState.isError = false;
  mocks.realtimeSpy.mockReset();
});

// ------------------------------------------------------------------
//  Tests
// ------------------------------------------------------------------

describe('<MyBadgesSection />', () => {
  it('affiche le titre "Mes badges"', () => {
    render(<MyBadgesSection userId={USER} />);
    expect(screen.getByText(/mes badges/i)).toBeInTheDocument();
  });

  it('affiche le compteur progress "X / Y débloqués"', () => {
    mocks.catalogState.data = [
      makeBadge({ code: 'a' }),
      makeBadge({ code: 'b' }),
      makeBadge({ code: 'c' }),
    ];
    mocks.userState.data = [
      makeUB({
        badge_code: 'a',
        badge: makeBadge({ code: 'a' }),
      }),
    ];

    render(<MyBadgesSection userId={USER} />);
    expect(screen.getByText(/1 \/ 3/)).toBeInTheDocument();
  });

  it('état loading : affiche le spinner + texte de chargement', () => {
    mocks.catalogState.isLoading = true;
    render(<MyBadgesSection userId={USER} />);
    expect(screen.getByText(/chargement/i)).toBeInTheDocument();
  });

  it('état error : affiche le message d erreur', () => {
    mocks.catalogState.isError = true;
    render(<MyBadgesSection userId={USER} />);
    // Le message loadError contient "charger" ou équivalent
    const errNode = screen.getByText(/impossible/i);
    expect(errNode).toBeInTheDocument();
  });

  it('état empty : catalogue vide → message dédié', () => {
    mocks.catalogState.data = [];
    render(<MyBadgesSection userId={USER} />);
    expect(screen.getByText(/aucun badge/i)).toBeInTheDocument();
  });

  it('état normal : rend une tuile par badge du catalogue', () => {
    mocks.catalogState.data = [
      makeBadge({ code: 'a', libelle: { fr: 'Alpha', en: 'Alpha' } }),
      makeBadge({ code: 'b', libelle: { fr: 'Beta', en: 'Beta' } }),
    ];

    render(<MyBadgesSection userId={USER} />);
    const grid = screen.getByRole('list');
    expect(within(grid).getAllByRole('listitem')).toHaveLength(2);
  });

  it('tri : badges gagnés en premier, non-gagnés ensuite', () => {
    mocks.catalogState.data = [
      makeBadge({
        code: 'not_earned',
        libelle: { fr: 'NotEarned', en: 'NotEarned' },
        sort_order: 1,
      }),
      makeBadge({
        code: 'earned',
        libelle: { fr: 'Earned', en: 'Earned' },
        sort_order: 2,
      }),
    ];
    mocks.userState.data = [
      makeUB({
        badge_code: 'earned',
        badge: makeBadge({ code: 'earned' }),
      }),
    ];

    render(<MyBadgesSection userId={USER} />);
    const items = screen.getAllByRole('listitem');
    // Le premier doit être "earned", le second "not_earned"
    expect(items[0]?.getAttribute('data-earned')).toBe('true');
    expect(items[1]?.getAttribute('data-earned')).toBe('false');
  });

  it('tri gagnés : legendary avant gold avant silver avant bronze', () => {
    mocks.catalogState.data = [
      makeBadge({
        code: 'bronze_b',
        tier: 'bronze',
        libelle: { fr: 'Bronze', en: 'Bronze' },
      }),
      makeBadge({
        code: 'legendary_l',
        tier: 'legendary',
        libelle: { fr: 'Legendary', en: 'Legendary' },
      }),
      makeBadge({
        code: 'gold_g',
        tier: 'gold',
        libelle: { fr: 'Gold', en: 'Gold' },
      }),
    ];
    mocks.userState.data = [
      makeUB({
        badge_code: 'bronze_b',
        badge: makeBadge({ code: 'bronze_b', tier: 'bronze' }),
      }),
      makeUB({
        badge_code: 'legendary_l',
        badge: makeBadge({ code: 'legendary_l', tier: 'legendary' }),
      }),
      makeUB({
        badge_code: 'gold_g',
        badge: makeBadge({ code: 'gold_g', tier: 'gold' }),
      }),
    ];

    render(<MyBadgesSection userId={USER} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]?.getAttribute('aria-label')).toBe('Legendary');
    expect(items[1]?.getAttribute('aria-label')).toBe('Gold');
    expect(items[2]?.getAttribute('aria-label')).toBe('Bronze');
  });

  it('tri non-gagnés : bronze avant silver avant gold avant legendary (objectifs accessibles d abord)', () => {
    mocks.catalogState.data = [
      makeBadge({
        code: 'legendary_l',
        tier: 'legendary',
        libelle: { fr: 'Legendary', en: 'Legendary' },
      }),
      makeBadge({
        code: 'bronze_b',
        tier: 'bronze',
        libelle: { fr: 'Bronze', en: 'Bronze' },
      }),
      makeBadge({
        code: 'gold_g',
        tier: 'gold',
        libelle: { fr: 'Gold', en: 'Gold' },
      }),
    ];
    mocks.userState.data = [];

    render(<MyBadgesSection userId={USER} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]?.getAttribute('aria-label')).toBe('Bronze');
    expect(items[1]?.getAttribute('aria-label')).toBe('Gold');
    expect(items[2]?.getAttribute('aria-label')).toBe('Legendary');
  });

  it('Realtime hook appelé avec le userId', () => {
    mocks.catalogState.data = [makeBadge({ code: 'a' })];
    render(<MyBadgesSection userId={USER} />);
    expect(mocks.realtimeSpy).toHaveBeenCalledWith(USER);
  });

  it('Realtime hook appelé avec undefined si pas de user', () => {
    mocks.catalogState.data = [makeBadge({ code: 'a' })];
    render(<MyBadgesSection userId={undefined} />);
    expect(mocks.realtimeSpy).toHaveBeenCalledWith(undefined);
  });
});
