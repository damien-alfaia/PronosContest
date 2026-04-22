import { render, screen, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { MyJokersSection } from '@/features/jokers/my-jokers-section';
import type { UserJokerWithCatalog } from '@/features/jokers/schemas';
import { i18n } from '@/i18n';

/**
 * Tests de rendu de `<MyJokersSection />`.
 *
 * Mocks :
 *   - `use-jokers` : on pilote `useUserJokersInConcoursQuery` depuis un
 *     state partagé (vi.hoisted), et on remplace `useUserJokersRealtime`
 *     par un spy pour vérifier qu'il est bien appelé avec (userId, concoursId).
 *
 * Invariants couverts :
 *   - non-rendu si `enabled = false` (concours sans jokers opt-in),
 *   - titre + progress "{{owned}} / {{total}} disponibles",
 *   - états loading / error / empty / normal,
 *   - tri : owned avant used,
 *   - Realtime appelé avec (userId, concoursId, { enabled }).
 */

const USER = '11111111-1111-1111-1111-111111111111';
const CONCOURS = '22222222-2222-2222-2222-222222222222';

const mocks = vi.hoisted(() => {
  return {
    userState: {
      data: [] as UserJokerWithCatalog[] | undefined,
      isLoading: false,
      isError: false,
    },
    realtimeSpy: vi.fn(),
  };
});

vi.mock('@/features/jokers/use-jokers', () => ({
  useUserJokersInConcoursQuery: () => ({
    data: mocks.userState.data,
    isLoading: mocks.userState.isLoading,
    isError: mocks.userState.isError,
  }),
  useUserJokersRealtime: (
    userId: string | undefined,
    concoursId: string | undefined,
    options: { enabled?: boolean } = {},
  ) => {
    mocks.realtimeSpy(userId, concoursId, options);
  },
}));

// ------------------------------------------------------------------
//  Factories
// ------------------------------------------------------------------

const validLocalized = { fr: 'Libellé', en: 'Label' };

const makeSlot = (
  over: Partial<UserJokerWithCatalog> & {
    id: string;
    joker_code: string;
    libelle?: { fr: string; en: string };
  },
): UserJokerWithCatalog => {
  const { libelle, ...rest } = over;
  const jokerLibelle = libelle ?? validLocalized;
  return {
    id: rest.id,
    user_id: USER,
    concours_id: CONCOURS,
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
    ...rest,
  };
};

// ------------------------------------------------------------------
//  Setup
// ------------------------------------------------------------------

beforeAll(async () => {
  await i18n.changeLanguage('fr');
});

beforeEach(() => {
  mocks.userState.data = [];
  mocks.userState.isLoading = false;
  mocks.userState.isError = false;
  mocks.realtimeSpy.mockReset();
});

// ------------------------------------------------------------------
//  Tests
// ------------------------------------------------------------------

describe('<MyJokersSection />', () => {
  it('ne rend rien si enabled = false (concours sans opt-in)', () => {
    const { container } = render(
      <MyJokersSection userId={USER} concoursId={CONCOURS} enabled={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('affiche le titre "Mes jokers"', () => {
    render(
      <MyJokersSection userId={USER} concoursId={CONCOURS} enabled={true} />,
    );
    expect(screen.getByText(/mes jokers/i)).toBeInTheDocument();
  });

  it('affiche le compteur progress "X / Y disponibles"', () => {
    mocks.userState.data = [
      makeSlot({ id: 'a', joker_code: 'double' }),
      makeSlot({ id: 'b', joker_code: 'triple' }),
      makeSlot({
        id: 'c',
        joker_code: 'gift',
        used_at: '2026-04-25T12:00:00Z',
      }),
    ];

    render(
      <MyJokersSection userId={USER} concoursId={CONCOURS} enabled={true} />,
    );
    // 2 owned / 3 total
    expect(screen.getByText(/2 \/ 3/)).toBeInTheDocument();
  });

  it('état loading : affiche le texte de chargement', () => {
    mocks.userState.isLoading = true;
    render(
      <MyJokersSection userId={USER} concoursId={CONCOURS} enabled={true} />,
    );
    expect(screen.getByText(/chargement/i)).toBeInTheDocument();
  });

  it('état error : affiche le message d erreur', () => {
    mocks.userState.isError = true;
    render(
      <MyJokersSection userId={USER} concoursId={CONCOURS} enabled={true} />,
    );
    expect(screen.getByText(/impossible/i)).toBeInTheDocument();
  });

  it('état empty : aucun slot → message dédié', () => {
    mocks.userState.data = [];
    render(
      <MyJokersSection userId={USER} concoursId={CONCOURS} enabled={true} />,
    );
    expect(screen.getByText(/aucun joker/i)).toBeInTheDocument();
  });

  it('état normal : rend une tuile par slot', () => {
    mocks.userState.data = [
      makeSlot({ id: 'a', joker_code: 'double' }),
      makeSlot({ id: 'b', joker_code: 'triple' }),
    ];

    render(
      <MyJokersSection userId={USER} concoursId={CONCOURS} enabled={true} />,
    );
    const grid = screen.getByRole('list');
    expect(within(grid).getAllByRole('listitem')).toHaveLength(2);
  });

  it('tri : owned avant used (data-owned="true" puis "false")', () => {
    mocks.userState.data = [
      // volontairement used avant owned dans la data source
      makeSlot({
        id: 'used',
        joker_code: 'triple',
        libelle: { fr: 'Triple', en: 'Triple' },
        used_at: '2026-04-25T12:00:00Z',
      }),
      makeSlot({
        id: 'owned',
        joker_code: 'double',
        libelle: { fr: 'Double', en: 'Double' },
      }),
    ];

    render(
      <MyJokersSection userId={USER} concoursId={CONCOURS} enabled={true} />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0]?.getAttribute('data-owned')).toBe('true');
    expect(items[1]?.getAttribute('data-owned')).toBe('false');
  });

  it('Realtime hook appelé avec (userId, concoursId, { enabled: true })', () => {
    mocks.userState.data = [makeSlot({ id: 'a', joker_code: 'double' })];
    render(
      <MyJokersSection userId={USER} concoursId={CONCOURS} enabled={true} />,
    );
    expect(mocks.realtimeSpy).toHaveBeenCalledWith(
      USER,
      CONCOURS,
      expect.objectContaining({ enabled: true }),
    );
  });

  it('Realtime hook appelé avec enabled=false si concours pas opt-in', () => {
    // Même si on ne rend rien, on appelle useUserJokersRealtime pour
    // éviter le "conditional hook call". Le spy doit refléter enabled:false.
    render(
      <MyJokersSection userId={USER} concoursId={CONCOURS} enabled={false} />,
    );
    expect(mocks.realtimeSpy).toHaveBeenCalledWith(
      USER,
      CONCOURS,
      expect.objectContaining({ enabled: false }),
    );
  });
});
