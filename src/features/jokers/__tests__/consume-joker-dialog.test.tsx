import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConsumeJokerDialog } from '@/features/jokers/consume-joker-dialog';
import type { UserJokerWithCatalog } from '@/features/jokers/schemas';
import { i18n } from '@/i18n';

/**
 * Tests de `<ConsumeJokerDialog />`.
 *
 * Mocks :
 *   - `@/features/pronos/use-pronos` : `useMatchsQuery` renvoie un state
 *     partagé via `vi.hoisted()`.
 *   - `@/features/jokers/use-jokers` : `useConcoursParticipantsForPickerQuery`,
 *     `useConsumeJokerMutation`, `useUserJokersInConcoursQuery` idem.
 *   - `sonner` : `toast.success` / `toast.error` spyés.
 *
 * Invariants couverts :
 *   - non-rendu si `open=false` OU `userJoker=null`,
 *   - branches picker par joker_code :
 *       double/triple/safety_net/boussole → match only,
 *       challenge/double_down             → match + user,
 *       gift                              → user + gifted,
 *       code inconnu                      → erreur `unknown_joker_code`,
 *   - filtrage côté client :
 *       matchs verrouillés (kick_off_at < now) exclus,
 *       self exclu de la liste des participants,
 *       slots used / gift / même code exclus de giftable,
 *   - submit désactivé tant que champs requis non remplis,
 *   - submit → mutate(args, { onSuccess, onError }) avec le bon shape,
 *   - onSuccess → toast.success + onOpenChange(false),
 *   - onError → toast.error avec le bon libellé i18n selon le code SQL,
 *   - Escape + click overlay → onOpenChange(false).
 */

// ------------------------------------------------------------------
//  Mocks hoisted
// ------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  return {
    matchsState: {
      data: [] as Array<{
        id: string;
        kick_off_at: string | null;
        equipe_a: { nom: string } | null;
        equipe_b: { nom: string } | null;
      }>,
      isLoading: false,
      isError: false,
    },
    participantsState: {
      data: [] as Array<{
        user_id: string;
        prenom: string | null;
        nom: string | null;
      }>,
      isLoading: false,
      isError: false,
    },
    myJokersState: {
      data: [] as UserJokerWithCatalog[],
      isLoading: false,
      isError: false,
    },
    mutateSpy: vi.fn(),
    isPending: false,
    toastSuccessSpy: vi.fn(),
    toastErrorSpy: vi.fn(),
  };
});

vi.mock('@/features/pronos/use-pronos', () => ({
  useMatchsQuery: () => ({
    data: mocks.matchsState.data,
    isLoading: mocks.matchsState.isLoading,
    isError: mocks.matchsState.isError,
  }),
}));

vi.mock('@/features/jokers/use-jokers', () => ({
  useConcoursParticipantsForPickerQuery: () => ({
    data: mocks.participantsState.data,
    isLoading: mocks.participantsState.isLoading,
    isError: mocks.participantsState.isError,
  }),
  useUserJokersInConcoursQuery: () => ({
    data: mocks.myJokersState.data,
    isLoading: mocks.myJokersState.isLoading,
    isError: mocks.myJokersState.isError,
  }),
  useConsumeJokerMutation: () => ({
    mutate: mocks.mutateSpy,
    isPending: mocks.isPending,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (msg: string) => mocks.toastSuccessSpy(msg),
    error: (msg: string) => mocks.toastErrorSpy(msg),
  },
}));

// ------------------------------------------------------------------
//  Factories
// ------------------------------------------------------------------

const USER = '11111111-1111-1111-1111-111111111111';
const OTHER_USER = '22222222-2222-2222-2222-222222222222';
const CONCOURS = '33333333-3333-3333-3333-333333333333';
const COMPETITION = '44444444-4444-4444-4444-444444444444';
const SLOT = '55555555-5555-5555-5555-555555555555';
const MATCH_FUTURE = '66666666-6666-6666-6666-666666666666';
const MATCH_PAST = '77777777-7777-7777-7777-777777777777';

const validLocalized = { fr: 'Double', en: 'Double' };

const makeSlot = (
  over: Partial<UserJokerWithCatalog> & {
    id?: string;
    joker_code: string;
    libelle?: { fr: string; en: string };
  },
): UserJokerWithCatalog => {
  const { libelle, ...rest } = over;
  return {
    id: rest.id ?? SLOT,
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
      libelle: libelle ?? validLocalized,
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

const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 60 * 60 * 1000).toISOString();

beforeAll(async () => {
  await i18n.changeLanguage('fr');
});

beforeEach(() => {
  mocks.matchsState.data = [
    {
      id: MATCH_FUTURE,
      kick_off_at: FUTURE,
      equipe_a: { nom: 'France' },
      equipe_b: { nom: 'Brésil' },
    },
    {
      id: MATCH_PAST,
      kick_off_at: PAST,
      equipe_a: { nom: 'Italie' },
      equipe_b: { nom: 'Espagne' },
    },
  ];
  mocks.matchsState.isLoading = false;
  mocks.matchsState.isError = false;

  mocks.participantsState.data = [
    { user_id: USER, prenom: 'Moi', nom: null },
    { user_id: OTHER_USER, prenom: 'Bob', nom: 'Martin' },
  ];
  mocks.participantsState.isLoading = false;
  mocks.participantsState.isError = false;

  mocks.myJokersState.data = [];
  mocks.myJokersState.isLoading = false;
  mocks.myJokersState.isError = false;

  mocks.mutateSpy.mockReset();
  mocks.isPending = false;
  mocks.toastSuccessSpy.mockReset();
  mocks.toastErrorSpy.mockReset();
});

const renderDialog = (overrides: {
  userJoker: UserJokerWithCatalog | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const onOpenChange = overrides.onOpenChange ?? vi.fn();
  const utils = render(
    <ConsumeJokerDialog
      userJoker={overrides.userJoker}
      concoursId={CONCOURS}
      competitionId={COMPETITION}
      currentUserId={USER}
      open={overrides.open ?? true}
      onOpenChange={onOpenChange}
    />,
  );
  return { ...utils, onOpenChange };
};

// ------------------------------------------------------------------
//  Tests
// ------------------------------------------------------------------

describe('<ConsumeJokerDialog />', () => {
  // ----- Rendu / non-rendu -----

  it('ne rend rien si open=false', () => {
    const { container } = renderDialog({
      userJoker: makeSlot({ joker_code: 'double' }),
      open: false,
    });
    expect(container.firstChild).toBeNull();
  });

  it('ne rend rien si userJoker=null', () => {
    const { container } = renderDialog({ userJoker: null, open: true });
    expect(container.firstChild).toBeNull();
  });

  it('rend le dialog avec role="dialog" aria-modal', () => {
    renderDialog({ userJoker: makeSlot({ joker_code: 'double' }) });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  // ----- Branches par joker_code -----

  it('joker_code=double → affiche picker match uniquement', () => {
    renderDialog({ userJoker: makeSlot({ joker_code: 'double' }) });
    expect(screen.getByLabelText(/match/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/participant/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/offrir/i)).not.toBeInTheDocument();
  });

  it('joker_code=triple → affiche picker match uniquement', () => {
    renderDialog({ userJoker: makeSlot({ joker_code: 'triple' }) });
    expect(screen.getByLabelText(/match/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/participant/i)).not.toBeInTheDocument();
  });

  it('joker_code=safety_net → affiche picker match uniquement', () => {
    renderDialog({ userJoker: makeSlot({ joker_code: 'safety_net' }) });
    expect(screen.getByLabelText(/match/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/participant/i)).not.toBeInTheDocument();
  });

  it('joker_code=boussole → affiche picker match uniquement', () => {
    renderDialog({ userJoker: makeSlot({ joker_code: 'boussole' }) });
    expect(screen.getByLabelText(/match/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/participant/i)).not.toBeInTheDocument();
  });

  it('joker_code=challenge → affiche picker match + user', () => {
    renderDialog({ userJoker: makeSlot({ joker_code: 'challenge' }) });
    expect(screen.getByLabelText(/match/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/participant/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/offrir/i)).not.toBeInTheDocument();
  });

  it('joker_code=double_down → affiche picker match + user', () => {
    renderDialog({ userJoker: makeSlot({ joker_code: 'double_down' }) });
    expect(screen.getByLabelText(/match/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/participant/i)).toBeInTheDocument();
  });

  it('joker_code=gift → affiche picker user + gifted, pas de match', () => {
    renderDialog({ userJoker: makeSlot({ joker_code: 'gift' }) });
    expect(screen.queryByLabelText(/match/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/participant/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/offrir/i)).toBeInTheDocument();
  });

  it('joker_code inconnu → affiche message d erreur et pas de form', () => {
    renderDialog({ userJoker: makeSlot({ joker_code: 'inconnu' }) });
    expect(screen.getByText(/inconnu/i)).toBeInTheDocument();
    // Aucun picker ni bouton submit (form absente)
    expect(screen.queryByLabelText(/match/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /activer le joker/i }),
    ).not.toBeInTheDocument();
  });

  // ----- Filtrage des données -----

  it('matchs verrouillés (kick_off_at passé) exclus du select', () => {
    renderDialog({ userJoker: makeSlot({ joker_code: 'double' }) });
    const select = screen.getByLabelText(/match/i) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain(MATCH_FUTURE);
    expect(values).not.toContain(MATCH_PAST);
  });

  it('self exclu du select participants (challenge)', () => {
    renderDialog({ userJoker: makeSlot({ joker_code: 'challenge' }) });
    const select = screen.getByLabelText(/participant/i) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).not.toContain(USER);
    expect(values).toContain(OTHER_USER);
  });

  it('giftable : slots used / slot courant / autres gift exclus', () => {
    const myGiftSlot = makeSlot({
      id: SLOT,
      joker_code: 'gift',
      libelle: { fr: 'Cadeau', en: 'Gift' },
    });
    mocks.myJokersState.data = [
      myGiftSlot, // le slot courant (exclu)
      makeSlot({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        joker_code: 'double',
        libelle: { fr: 'Double', en: 'Double' },
      }),
      makeSlot({
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        joker_code: 'triple',
        libelle: { fr: 'Triple', en: 'Triple' },
        used_at: '2026-04-25T12:00:00Z', // slot used (exclu)
      }),
      makeSlot({
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        joker_code: 'gift', // autre gift (exclu)
        libelle: { fr: 'Cadeau bis', en: 'Gift 2' },
      }),
    ];

    renderDialog({ userJoker: myGiftSlot });
    const select = screen.getByLabelText(/offrir/i) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    // Seul "double" doit rester (placeholder "" + double)
    expect(values).toContain('double');
    expect(values).not.toContain('gift');
    expect(values).not.toContain('triple');
  });

  // ----- Submit -----

  it('submit désactivé tant que matchId vide (double)', () => {
    renderDialog({ userJoker: makeSlot({ joker_code: 'double' }) });
    const submit = screen.getByRole('button', {
      name: /activer le joker/i,
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('submit activé quand match sélectionné (double)', () => {
    renderDialog({ userJoker: makeSlot({ joker_code: 'double' }) });
    const select = screen.getByLabelText(/match/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: MATCH_FUTURE } });

    const submit = screen.getByRole('button', {
      name: /activer le joker/i,
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
  });

  it('submit (double) → mutate({ userJokerId, targetMatchId, targetUserId:null, payload:null })', () => {
    renderDialog({ userJoker: makeSlot({ joker_code: 'double' }) });

    fireEvent.change(screen.getByLabelText(/match/i), {
      target: { value: MATCH_FUTURE },
    });
    fireEvent.click(screen.getByRole('button', { name: /activer le joker/i }));

    expect(mocks.mutateSpy).toHaveBeenCalledTimes(1);
    expect(mocks.mutateSpy.mock.calls[0]?.[0]).toEqual({
      userJokerId: SLOT,
      targetMatchId: MATCH_FUTURE,
      targetUserId: null,
      payload: null,
    });
  });

  it('submit (challenge) → mutate inclut targetUserId', () => {
    renderDialog({ userJoker: makeSlot({ joker_code: 'challenge' }) });

    fireEvent.change(screen.getByLabelText(/match/i), {
      target: { value: MATCH_FUTURE },
    });
    fireEvent.change(screen.getByLabelText(/participant/i), {
      target: { value: OTHER_USER },
    });
    fireEvent.click(screen.getByRole('button', { name: /activer le joker/i }));

    expect(mocks.mutateSpy).toHaveBeenCalledTimes(1);
    expect(mocks.mutateSpy.mock.calls[0]?.[0]).toEqual({
      userJokerId: SLOT,
      targetMatchId: MATCH_FUTURE,
      targetUserId: OTHER_USER,
      payload: null,
    });
  });

  it('submit (gift) → mutate avec payload.gifted_joker_code, targetMatchId:null', () => {
    const giftSlot = makeSlot({
      joker_code: 'gift',
      libelle: { fr: 'Cadeau', en: 'Gift' },
    });
    mocks.myJokersState.data = [
      giftSlot,
      makeSlot({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        joker_code: 'double',
        libelle: { fr: 'Double', en: 'Double' },
      }),
    ];

    renderDialog({ userJoker: giftSlot });

    fireEvent.change(screen.getByLabelText(/participant/i), {
      target: { value: OTHER_USER },
    });
    fireEvent.change(screen.getByLabelText(/offrir/i), {
      target: { value: 'double' },
    });
    fireEvent.click(screen.getByRole('button', { name: /activer le joker/i }));

    expect(mocks.mutateSpy).toHaveBeenCalledTimes(1);
    expect(mocks.mutateSpy.mock.calls[0]?.[0]).toEqual({
      userJokerId: SLOT,
      targetMatchId: null,
      targetUserId: OTHER_USER,
      payload: { gifted_joker_code: 'double' },
    });
  });

  // ----- onSuccess / onError -----

  it('onSuccess → toast.success + onOpenChange(false)', () => {
    const onOpenChange = vi.fn();
    renderDialog({
      userJoker: makeSlot({ joker_code: 'double' }),
      onOpenChange,
    });

    fireEvent.change(screen.getByLabelText(/match/i), {
      target: { value: MATCH_FUTURE },
    });
    fireEvent.click(screen.getByRole('button', { name: /activer le joker/i }));

    const onSuccess = mocks.mutateSpy.mock.calls[0]?.[1]?.onSuccess;
    onSuccess?.();

    expect(mocks.toastSuccessSpy).toHaveBeenCalledTimes(1);
    // Libellé FR contient "Double" (le nom du joker)
    expect(mocks.toastSuccessSpy.mock.calls[0]?.[0]).toMatch(/Double/);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('onError (match_locked) → toast.error avec le libellé spécifique', () => {
    renderDialog({ userJoker: makeSlot({ joker_code: 'double' }) });

    fireEvent.change(screen.getByLabelText(/match/i), {
      target: { value: MATCH_FUTURE },
    });
    fireEvent.click(screen.getByRole('button', { name: /activer le joker/i }));

    const onError = mocks.mutateSpy.mock.calls[0]?.[1]?.onError;
    onError?.(new Error('match_locked'));

    expect(mocks.toastErrorSpy).toHaveBeenCalledTimes(1);
    // Libellé spécifique "verrouillé" (fr) — pas le generic
    expect(mocks.toastErrorSpy.mock.calls[0]?.[0]).toMatch(/verrouillé/i);
  });

  it('onError (category_already_used_on_match) → toast.error libellé dédié', () => {
    renderDialog({ userJoker: makeSlot({ joker_code: 'double' }) });

    fireEvent.change(screen.getByLabelText(/match/i), {
      target: { value: MATCH_FUTURE },
    });
    fireEvent.click(screen.getByRole('button', { name: /activer le joker/i }));

    const onError = mocks.mutateSpy.mock.calls[0]?.[1]?.onError;
    onError?.(new Error('category_already_used_on_match'));

    expect(mocks.toastErrorSpy).toHaveBeenCalledTimes(1);
    expect(mocks.toastErrorSpy.mock.calls[0]?.[0]).toMatch(/catégorie/i);
  });

  it('onError (code inconnu) → fallback toast.error generic', () => {
    renderDialog({ userJoker: makeSlot({ joker_code: 'double' }) });

    fireEvent.change(screen.getByLabelText(/match/i), {
      target: { value: MATCH_FUTURE },
    });
    fireEvent.click(screen.getByRole('button', { name: /activer le joker/i }));

    const onError = mocks.mutateSpy.mock.calls[0]?.[1]?.onError;
    onError?.(new Error('completely_unknown_error_string'));

    expect(mocks.toastErrorSpy).toHaveBeenCalledTimes(1);
    // Generic FR : "Impossible d'activer ce joker."
    expect(mocks.toastErrorSpy.mock.calls[0]?.[0]).toMatch(/impossible/i);
  });

  // ----- Close (Escape / overlay click / cancel button) -----

  it('Escape → onOpenChange(false)', () => {
    const onOpenChange = vi.fn();
    renderDialog({
      userJoker: makeSlot({ joker_code: 'double' }),
      onOpenChange,
    });

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('click sur overlay (backdrop) → onOpenChange(false)', () => {
    const onOpenChange = vi.fn();
    renderDialog({
      userJoker: makeSlot({ joker_code: 'double' }),
      onOpenChange,
    });

    const dialog = screen.getByRole('dialog');
    // click direct sur le backdrop (currentTarget === target)
    fireEvent.click(dialog);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('bouton Annuler → onOpenChange(false)', () => {
    const onOpenChange = vi.fn();
    renderDialog({
      userJoker: makeSlot({ joker_code: 'double' }),
      onOpenChange,
    });

    fireEvent.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // ----- isPending -----

  it('isPending=true → submit désactivé et libellé "Activation…"', () => {
    mocks.isPending = true;
    renderDialog({ userJoker: makeSlot({ joker_code: 'double' }) });

    const submit = screen.getByRole('button', {
      name: /activation/i,
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });
});
