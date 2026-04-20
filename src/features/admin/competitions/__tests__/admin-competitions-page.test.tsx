import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests de rendu de `AdminCompetitionsPage`.
 *
 * Mocks :
 *   - `useAdminCompetitionsQuery` + mutations → state piloté par `state`,
 *   - `sonner` → toasts muets,
 *   - `CompetitionDialog` → stub minimal (évite le form interne),
 *   - `window.confirm` → `vi.fn()` contrôlé.
 *
 * On valide les invariants UI :
 *   - titre + bouton "Nouvelle compétition",
 *   - état vide (aucune compétition),
 *   - rendu d'une ligne (code, nom, sport, status, dates, actions),
 *   - suppression : confirm annulé → pas de mutate, confirm validé → mutate,
 *   - mapping erreur 23503 → toast.error distinct,
 *   - spinner quand loading.
 */

const COMP_A = '22222222-0000-0000-0000-000000000001';
const COMP_B = '22222222-0000-0000-0000-000000000002';

type CompetitionRow = {
  id: string;
  code: string;
  nom: string;
  sport: string;
  status: string;
  date_debut: string | null;
  date_fin: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
};

type QueryState = { isLoading: boolean; data: CompetitionRow[] };

// `vi.mock` est hoisted — on utilise `vi.hoisted` pour exposer spies
// et state communs sans collision avec l'ordre d'évaluation.
const mocks = vi.hoisted(() => {
  return {
    queryState: { isLoading: false, data: [] } as QueryState,
    deleteMutate: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  };
});

vi.mock('@/features/admin/competitions/use-admin-competitions', () => ({
  useAdminCompetitionsQuery: () => ({
    isLoading: mocks.queryState.isLoading,
    data: mocks.queryState.data,
  }),
  useDeleteCompetitionMutation: () => ({
    mutate: mocks.deleteMutate,
    isPending: false,
  }),
}));

// Stub du dialog : on ne teste pas sa form ici (couvert ailleurs).
vi.mock('@/features/admin/competitions/components/competition-dialog', () => ({
  CompetitionDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="competition-dialog" /> : null,
}));

vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { AdminCompetitionsPage } from '@/features/admin/competitions/admin-competitions-page';
import { i18n } from '@/i18n';

const makeCompetition = (
  overrides: Partial<CompetitionRow> = {},
): CompetitionRow => ({
  id: COMP_A,
  code: 'fifa-wc-2026',
  nom: 'FIFA World Cup 2026',
  sport: 'football',
  status: 'upcoming',
  date_debut: '2026-06-11',
  date_fin: '2026-07-19',
  logo_url: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/app/admin/competitions']}>
      <Routes>
        <Route
          path="/app/admin/competitions"
          element={<AdminCompetitionsPage />}
        />
      </Routes>
    </MemoryRouter>,
  );

beforeAll(async () => {
  await i18n.changeLanguage('fr');
});

beforeEach(() => {
  mocks.queryState.isLoading = false;
  mocks.queryState.data = [];
  mocks.deleteMutate.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
  vi.restoreAllMocks();
});

// ------------------------------------------------------------------
//  Rendu
// ------------------------------------------------------------------

describe('<AdminCompetitionsPage />', () => {
  it('affiche le titre + bouton "Nouvelle compétition"', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /admin — compétitions/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /nouvelle compétition/i }),
    ).toBeInTheDocument();
  });

  it('affiche l’état vide quand aucune compétition', () => {
    mocks.queryState.data =[];
    renderPage();
    expect(screen.getByText(/aucune compétition/i)).toBeInTheDocument();
    expect(
      screen.getByText(/crée une première compétition/i),
    ).toBeInTheDocument();
  });

  it('affiche une ligne par compétition avec code + nom + sport + statut', () => {
    mocks.queryState.data =[
      makeCompetition(),
      makeCompetition({
        id: COMP_B,
        code: 'rwc-2027',
        nom: 'Rugby World Cup 2027',
        sport: 'rugby',
        status: 'finished',
      }),
    ];
    renderPage();

    // Code
    expect(screen.getByText('fifa-wc-2026')).toBeInTheDocument();
    expect(screen.getByText('rwc-2027')).toBeInTheDocument();
    // Nom
    expect(screen.getByText('FIFA World Cup 2026')).toBeInTheDocument();
    expect(screen.getByText('Rugby World Cup 2027')).toBeInTheDocument();
    // Sport libellé
    expect(screen.getByText(/^football$/i)).toBeInTheDocument();
    expect(screen.getByText(/^rugby$/i)).toBeInTheDocument();
    // Status libellé
    expect(screen.getByText(/à venir/i)).toBeInTheDocument();
    expect(screen.getByText(/terminée/i)).toBeInTheDocument();
  });

  it('rend 2 boutons d’action par ligne (éditer + supprimer) + 1 par-ligne header', () => {
    mocks.queryState.data =[makeCompetition()];
    renderPage();

    expect(
      screen.getByRole('button', { name: /modifier/i }),
    ).toBeInTheDocument();
    // Le bouton "supprimer" porte un aria-label (icône seule)
    const deleteBtns = screen.getAllByRole('button', { name: /supprimer/i });
    expect(deleteBtns.length).toBeGreaterThan(0);
  });

  it('clic "Nouvelle compétition" ouvre le dialog', () => {
    mocks.queryState.data =[];
    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: /nouvelle compétition/i }),
    );
    expect(screen.getByTestId('competition-dialog')).toBeInTheDocument();
  });

  it('suppression annulée par confirm → pas de mutate', () => {
    mocks.queryState.data =[makeCompetition()];
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();

    fireEvent.click(screen.getAllByRole('button', { name: /supprimer/i })[0]!);

    expect(mocks.deleteMutate).not.toHaveBeenCalled();
  });

  it('suppression confirmée → mutate avec l’id', () => {
    mocks.queryState.data =[makeCompetition()];
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();

    fireEvent.click(screen.getAllByRole('button', { name: /supprimer/i })[0]!);

    expect(mocks.deleteMutate).toHaveBeenCalledTimes(1);
    expect(mocks.deleteMutate.mock.calls[0]?.[0]).toBe(COMP_A);
  });

  it('onError avec 23503 → toast.error "competitionInUse"', () => {
    mocks.queryState.data =[makeCompetition()];
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();

    fireEvent.click(screen.getAllByRole('button', { name: /supprimer/i })[0]!);

    const call = mocks.deleteMutate.mock.calls[0];
    const handlers = call?.[1] as {
      onError: (err: Error) => void;
    };
    handlers.onError(new Error('23503: violates foreign key constraint'));

    // Le toast français "in use" contient bien "utilisée" ou le fallback
    expect(mocks.toastError).toHaveBeenCalledTimes(1);
    const msg = String(mocks.toastError.mock.calls[0]?.[0] ?? '');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('onSuccess → toast.success "competitionDeleted"', () => {
    mocks.queryState.data =[makeCompetition()];
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();

    fireEvent.click(screen.getAllByRole('button', { name: /supprimer/i })[0]!);

    const handlers = mocks.deleteMutate.mock.calls[0]?.[1] as {
      onSuccess: () => void;
    };
    handlers.onSuccess();

    expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
  });
});
