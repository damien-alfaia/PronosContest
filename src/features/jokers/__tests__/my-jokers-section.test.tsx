import { fireEvent, render, screen, within } from '@testing-library/react';
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
    dialogSpy: vi.fn(),
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

/**
 * Stub du dialog : on ne veut pas faire tourner ses hooks internes
 * (`useMatchsQuery`, `useConsumeJokerMutation`, …) ici — ils sont
 * testés dans `consume-joker-dialog.test.tsx`. On se contente de
 * rendre un marqueur qui prouve que le dialog a bien été monté, et
 * d'exposer un bouton qui simule la fermeture (onOpenChange(false)).
 */
vi.mock('@/features/jokers/consume-joker-dialog', () => ({
  ConsumeJokerDialog: (props: {
    userJoker: UserJokerWithCatalog | null;
    concoursId: string;
    competitionId: string | undefined;
    currentUserId: string | undefined;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => {
    mocks.dialogSpy({
      userJokerId: props.userJoker?.id,
      concoursId: props.concoursId,
      competitionId: props.competitionId,
      currentUserId: props.currentUserId,
      open: props.open,
    });
    if (!props.open || !props.userJoker) return null;
    return (
      <div data-testid="consume-joker-dialog-stub">
        <span data-testid="consume-slot-id">{props.userJoker.id}</span>
        <button
          type="button"
          onClick={() => props.onOpenChange(false)}
          data-testid="consume-close"
        >
          close
        </button>
      </div>
    );
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
  mocks.dialogSpy.mockReset();
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

  // ----- Activation : click sur tuile owned → dialog monté -----

  it('dialog NON monté tant qu aucune tuile n est cliquée', () => {
    mocks.userState.data = [makeSlot({ id: 'slot-a', joker_code: 'double' })];
    render(
      <MyJokersSection
        userId={USER}
        concoursId={CONCOURS}
        competitionId="comp-1"
        enabled={true}
      />,
    );
    expect(
      screen.queryByTestId('consume-joker-dialog-stub'),
    ).not.toBeInTheDocument();
  });

  it('click sur tuile owned → mount dialog avec le bon slot + competitionId', () => {
    mocks.userState.data = [makeSlot({ id: 'slot-a', joker_code: 'double' })];
    render(
      <MyJokersSection
        userId={USER}
        concoursId={CONCOURS}
        competitionId="comp-1"
        enabled={true}
      />,
    );

    // La tuile owned est un <button role="listitem"> cliquable.
    const items = screen.getAllByRole('listitem');
    fireEvent.click(items[0]!);

    expect(screen.getByTestId('consume-joker-dialog-stub')).toBeInTheDocument();
    expect(screen.getByTestId('consume-slot-id')).toHaveTextContent('slot-a');

    // Le spy du stub doit avoir reçu les bonnes props.
    const lastCall = mocks.dialogSpy.mock.calls.at(-1)?.[0];
    expect(lastCall).toMatchObject({
      userJokerId: 'slot-a',
      concoursId: CONCOURS,
      competitionId: 'comp-1',
      currentUserId: USER,
      open: true,
    });
  });

  it('click sur tuile used n ouvre PAS le dialog', () => {
    mocks.userState.data = [
      makeSlot({
        id: 'slot-used',
        joker_code: 'double',
        used_at: '2026-04-25T12:00:00Z',
      }),
    ];
    render(
      <MyJokersSection
        userId={USER}
        concoursId={CONCOURS}
        competitionId="comp-1"
        enabled={true}
      />,
    );

    // La tuile used reste un <div role="listitem"> non cliquable — un
    // éventuel click ne déclenche rien.
    const items = screen.getAllByRole('listitem');
    fireEvent.click(items[0]!);

    expect(
      screen.queryByTestId('consume-joker-dialog-stub'),
    ).not.toBeInTheDocument();
  });

  it('onOpenChange(false) depuis le dialog → dialog démonté', () => {
    mocks.userState.data = [makeSlot({ id: 'slot-a', joker_code: 'double' })];
    render(
      <MyJokersSection
        userId={USER}
        concoursId={CONCOURS}
        competitionId="comp-1"
        enabled={true}
      />,
    );

    // Ouvrir
    fireEvent.click(screen.getAllByRole('listitem')[0]!);
    expect(screen.getByTestId('consume-joker-dialog-stub')).toBeInTheDocument();

    // Fermer
    fireEvent.click(screen.getByTestId('consume-close'));
    expect(
      screen.queryByTestId('consume-joker-dialog-stub'),
    ).not.toBeInTheDocument();
  });

  it('dialog non monté si concoursId manquant (garde caller)', () => {
    mocks.userState.data = [makeSlot({ id: 'slot-a', joker_code: 'double' })];
    render(
      <MyJokersSection
        userId={USER}
        concoursId={undefined}
        competitionId="comp-1"
        enabled={true}
      />,
    );
    // Pas de concoursId → même un click ne monte pas le dialog (le
    // caller garantit `concoursId && selectedUserJoker ? ...`).
    const items = screen.queryAllByRole('listitem');
    if (items[0]) fireEvent.click(items[0]);
    expect(
      screen.queryByTestId('consume-joker-dialog-stub'),
    ).not.toBeInTheDocument();
  });
});
