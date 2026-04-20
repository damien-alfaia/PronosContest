import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests de rendu de `AdminEquipesPage`.
 *
 * Mocks :
 *   - `useCompetitionsQuery` → 1 compétition par défaut,
 *   - `useAdminEquipesQuery` + `useDeleteEquipeMutation` → state piloté,
 *   - `EquipeDialog` → stub minimal,
 *   - `sonner` → toasts muets,
 *   - `window.confirm` → contrôlé via vi.spyOn.
 *
 * Invariants :
 *   - affiche le titre + bouton création activé,
 *   - état "pas de compétition" si la liste est vide,
 *   - rendu d'une ligne (groupe badge, code, nom, fifa_id, drapeau img),
 *   - suppression : confirm false → pas de mutate, true → mutate,
 *   - onError 23503 → toast.error, onSuccess → toast.success,
 *   - dialog rendu seulement si competition sélectionnée.
 */

const COMP = '22222222-0000-0000-0000-000000000001';
const EQ_A = '33333333-0000-0000-0000-000000000001';
const EQ_B = '33333333-0000-0000-0000-000000000002';

type EquipeRow = {
  id: string;
  competition_id: string;
  code: string;
  nom: string;
  groupe: string | null;
  drapeau_url: string | null;
  fifa_id: number | null;
  created_at: string;
  updated_at: string;
};

type CompetitionRef = { id: string; nom: string };

type CompQueryState = {
  isLoading: boolean;
  data: CompetitionRef[];
};
type EquipesQueryState = { isLoading: boolean; data: EquipeRow[] };

// `vi.mock` est hoisted — on expose spies + state via `vi.hoisted`
// pour éviter la TDZ sur les variables top-level.
const mocks = vi.hoisted(() => {
  const compState: CompQueryState = {
    isLoading: false,
    data: [] as CompetitionRef[],
  };
  const equipesState: EquipesQueryState = { isLoading: false, data: [] };
  return {
    compState,
    equipesState,
    deleteMutate: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  };
});

vi.mock('@/features/concours/use-concours', () => ({
  useCompetitionsQuery: () => ({
    isLoading: mocks.compState.isLoading,
    data: mocks.compState.data,
  }),
}));

vi.mock('@/features/admin/equipes/use-admin-equipes', () => ({
  useAdminEquipesQuery: () => ({
    isLoading: mocks.equipesState.isLoading,
    data: mocks.equipesState.data,
  }),
  useDeleteEquipeMutation: () => ({
    mutate: mocks.deleteMutate,
    isPending: false,
  }),
}));

vi.mock('@/features/admin/equipes/components/equipe-dialog', () => ({
  EquipeDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="equipe-dialog" /> : null,
}));

vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { AdminEquipesPage } from '@/features/admin/equipes/admin-equipes-page';
import { i18n } from '@/i18n';

const makeEquipe = (overrides: Partial<EquipeRow> = {}): EquipeRow => ({
  id: EQ_A,
  competition_id: COMP,
  code: 'FRA',
  nom: 'France',
  groupe: 'A',
  drapeau_url: 'https://example.com/fr.svg',
  fifa_id: 103,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/app/admin/equipes']}>
      <Routes>
        <Route path="/app/admin/equipes" element={<AdminEquipesPage />} />
      </Routes>
    </MemoryRouter>,
  );

beforeAll(async () => {
  await i18n.changeLanguage('fr');
});

beforeEach(() => {
  mocks.compState.isLoading = false;
  mocks.compState.data = [{ id: COMP, nom: 'FIFA WC 2026' }];
  mocks.equipesState.isLoading = false;
  mocks.equipesState.data = [];
  mocks.deleteMutate.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
  vi.restoreAllMocks();
});

// ------------------------------------------------------------------
//  Rendu
// ------------------------------------------------------------------

describe('<AdminEquipesPage />', () => {
  it('affiche le titre + sélecteur de compétition + bouton création', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /admin — équipes/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: /fifa wc 2026/i }),
    ).toBeInTheDocument();
    const create = screen.getByRole('button', { name: /nouvelle équipe/i });
    expect(create).toBeEnabled();
  });

  it('affiche le message "aucune compétition" quand la liste est vide', () => {
    mocks.compState.data = [];
    renderPage();
    expect(
      screen.getByText(/aucune compétition disponible/i),
    ).toBeInTheDocument();
  });

  it('affiche l’état vide (table) quand pas d’équipe', () => {
    mocks.equipesState.data = [];
    renderPage();
    expect(screen.getByText(/aucune équipe/i)).toBeInTheDocument();
  });

  it('rend une ligne par équipe avec groupe, code, nom, fifa_id, drapeau <img>', () => {
    mocks.equipesState.data = [
      makeEquipe(),
      makeEquipe({
        id: EQ_B,
        code: 'GER',
        nom: 'Allemagne',
        groupe: 'A',
        fifa_id: 104,
        drapeau_url: null,
      }),
    ];
    renderPage();

    expect(screen.getByText('FRA')).toBeInTheDocument();
    expect(screen.getByText('GER')).toBeInTheDocument();
    expect(screen.getByText('France')).toBeInTheDocument();
    expect(screen.getByText('Allemagne')).toBeInTheDocument();
    expect(screen.getByText('103')).toBeInTheDocument();
    expect(screen.getByText('104')).toBeInTheDocument();

    // Un drapeau rendu via <img alt="Drapeau France">
    const flag = screen.getByRole('img', { name: /drapeau france/i });
    expect(flag).toHaveAttribute('src', 'https://example.com/fr.svg');
  });

  it('clic "Nouvelle équipe" ouvre le dialog', () => {
    mocks.equipesState.data = [];
    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: /nouvelle équipe/i }),
    );
    expect(screen.getByTestId('equipe-dialog')).toBeInTheDocument();
  });

  it('suppression annulée → pas de mutate', () => {
    mocks.equipesState.data = [makeEquipe()];
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();

    fireEvent.click(screen.getAllByRole('button', { name: /supprimer/i })[0]!);

    expect(mocks.deleteMutate).not.toHaveBeenCalled();
  });

  it('suppression confirmée → mutate avec l’id', () => {
    mocks.equipesState.data = [makeEquipe()];
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();

    fireEvent.click(screen.getAllByRole('button', { name: /supprimer/i })[0]!);

    expect(mocks.deleteMutate).toHaveBeenCalledTimes(1);
    expect(mocks.deleteMutate.mock.calls[0]?.[0]).toBe(EQ_A);
  });

  it('onError 23503 → toast.error (équipe utilisée par un match)', () => {
    mocks.equipesState.data = [makeEquipe()];
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();

    fireEvent.click(screen.getAllByRole('button', { name: /supprimer/i })[0]!);

    const handlers = mocks.deleteMutate.mock.calls[0]?.[1] as {
      onError: (err: Error) => void;
    };
    handlers.onError(new Error('23503: violates foreign key constraint'));

    expect(mocks.toastError).toHaveBeenCalledTimes(1);
  });

  it('onSuccess → toast.success', () => {
    mocks.equipesState.data = [makeEquipe()];
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();

    fireEvent.click(screen.getAllByRole('button', { name: /supprimer/i })[0]!);

    const handlers = mocks.deleteMutate.mock.calls[0]?.[1] as {
      onSuccess: () => void;
    };
    handlers.onSuccess();

    expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
  });

  it('pas de dialog si aucune compétition effective (rien ne match)', () => {
    mocks.compState.data = [];
    renderPage();
    expect(screen.queryByTestId('equipe-dialog')).not.toBeInTheDocument();
  });
});
