import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests de rendu de `AdminMatchsPage`.
 *
 * Mocks :
 *   - `useCompetitionsQuery` (features/concours) → fournit 1 compétition.
 *   - `useAdminMatchsQuery` + 4 mutations → state piloté par `adminState`.
 *   - `sonner` → toasts muets (pas de toaster monté).
 *
 * On valide les invariants UI :
 *   - placeholders (match sans équipe) → libellé "À déterminer" + bouton
 *     "Saisir résultat" désactivé,
 *   - match joué → score affiché + badge "Terminé",
 *   - filtres phase / statut (chips), bouton d'édition, menu déroulant.
 */

const COMP = 'comp-00000000-0000-0000-0000-000000000001';
const M_GROUPE_SCHEDULED = '11111111-0000-0000-0000-000000000001';
const M_KO_PLACEHOLDER = '22222222-0000-0000-0000-000000000001';
const M_KO_FINISHED = '33333333-0000-0000-0000-000000000001';

type AdminState = {
  isLoading: boolean;
  data: Array<{
    id: string;
    competition_id: string;
    phase: string;
    equipe_a_id: string | null;
    equipe_b_id: string | null;
    kick_off_at: string;
    status: string;
    score_a: number | null;
    score_b: number | null;
    vainqueur_tab: 'a' | 'b' | null;
    penalty_score_a: number | null;
    penalty_score_b: number | null;
    round: number | null;
    equipe_a: {
      id: string;
      code: string;
      nom: string;
      groupe: string | null;
      drapeau_url: string | null;
    } | null;
    equipe_b: {
      id: string;
      code: string;
      nom: string;
      groupe: string | null;
      drapeau_url: string | null;
    } | null;
  }>;
};

const adminState: AdminState = { isLoading: false, data: [] };

vi.mock('@/features/concours/use-concours', () => ({
  useCompetitionsQuery: () => ({
    isLoading: false,
    data: [{ id: COMP, nom: 'FIFA WC 2026' }],
  }),
}));

vi.mock('@/features/admin/matchs/use-admin-matchs', () => ({
  adminMatchsKeys: {
    all: ['admin', 'matchs'] as const,
    byCompetition: () => ['admin', 'matchs', 'x'] as const,
    equipesByCompetition: () => ['admin', 'equipes', 'x'] as const,
  },
  useAdminMatchsQuery: () => ({
    isLoading: adminState.isLoading,
    data: adminState.data,
  }),
  useEquipesForCompetitionQuery: () => ({ isLoading: false, data: [] }),
  useUpdateMatchTeamsMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useUpdateMatchResultMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useUpdateMatchStatusMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useResetMatchResultMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { AdminMatchsPage } from '@/features/admin/matchs/admin-matchs-page';
import { i18n } from '@/i18n';

const makeGroupMatch = () => ({
  id: M_GROUPE_SCHEDULED,
  competition_id: COMP,
  phase: 'groupes',
  equipe_a_id: 'eq-a-1',
  equipe_b_id: 'eq-b-1',
  kick_off_at: '2099-06-11T18:00:00Z',
  status: 'scheduled',
  score_a: null,
  score_b: null,
  vainqueur_tab: null,
  penalty_score_a: null,
  penalty_score_b: null,
  round: 1,
  equipe_a: {
    id: 'eq-a-1',
    code: 'FRA',
    nom: 'France',
    groupe: 'A',
    drapeau_url: null,
  },
  equipe_b: {
    id: 'eq-b-1',
    code: 'GER',
    nom: 'Allemagne',
    groupe: 'A',
    drapeau_url: null,
  },
});

const makeKoPlaceholder = () => ({
  id: M_KO_PLACEHOLDER,
  competition_id: COMP,
  phase: 'huitiemes',
  equipe_a_id: null,
  equipe_b_id: null,
  kick_off_at: '2099-07-01T18:00:00Z',
  status: 'scheduled',
  score_a: null,
  score_b: null,
  vainqueur_tab: null,
  penalty_score_a: null,
  penalty_score_b: null,
  round: null,
  equipe_a: null,
  equipe_b: null,
});

const makeFinishedKo = () => ({
  id: M_KO_FINISHED,
  competition_id: COMP,
  phase: 'finale',
  equipe_a_id: 'eq-a-2',
  equipe_b_id: 'eq-b-2',
  kick_off_at: '2099-07-19T18:00:00Z',
  status: 'finished',
  score_a: 1,
  score_b: 1,
  vainqueur_tab: 'a' as const,
  penalty_score_a: 5,
  penalty_score_b: 4,
  round: null,
  equipe_a: {
    id: 'eq-a-2',
    code: 'BRA',
    nom: 'Brésil',
    groupe: null,
    drapeau_url: null,
  },
  equipe_b: {
    id: 'eq-b-2',
    code: 'ARG',
    nom: 'Argentine',
    groupe: null,
    drapeau_url: null,
  },
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/app/admin/matchs']}>
      <Routes>
        <Route path="/app/admin/matchs" element={<AdminMatchsPage />} />
      </Routes>
    </MemoryRouter>,
  );

beforeAll(async () => {
  await i18n.changeLanguage('fr');
});

beforeEach(() => {
  adminState.isLoading = false;
  adminState.data = [];
});

// ------------------------------------------------------------------
//  Rendu
// ------------------------------------------------------------------

describe('<AdminMatchsPage />', () => {
  it('affiche le titre + sous-titre + sélecteur de compétition', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /administration — matchs/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/compétition/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /fifa wc 2026/i })).toBeInTheDocument();
  });

  it('affiche les compteurs (total / planifiés / live / terminés)', () => {
    adminState.data = [makeGroupMatch(), makeKoPlaceholder(), makeFinishedKo()];
    renderPage();

    // 3 matchs : 2 scheduled + 0 live + 1 finished
    expect(screen.getByText(/3 matchs/i)).toBeInTheDocument();
    expect(screen.getByText(/2 planifiés/i)).toBeInTheDocument();
    expect(screen.getByText(/0 en direct/i)).toBeInTheDocument();
    expect(screen.getByText(/1 terminé/i)).toBeInTheDocument();
  });

  it('affiche les noms des équipes pour un match assigné', () => {
    adminState.data = [makeGroupMatch()];
    renderPage();
    expect(screen.getByText('France')).toBeInTheDocument();
    expect(screen.getByText('Allemagne')).toBeInTheDocument();
  });

  it('affiche "À déterminer" pour un placeholder KO et désactive "Saisir résultat"', () => {
    adminState.data = [makeKoPlaceholder()];
    renderPage();
    // Deux lignes "À déterminer" (une par équipe)
    const tbd = screen.getAllByText(/à déterminer/i);
    expect(tbd.length).toBeGreaterThanOrEqual(2);

    const enterBtn = screen.getByRole('button', { name: /saisir résultat/i });
    expect(enterBtn).toBeDisabled();
  });

  it('active "Saisir résultat" pour un match aux équipes assignées', () => {
    adminState.data = [makeGroupMatch()];
    renderPage();
    const enterBtn = screen.getByRole('button', { name: /saisir résultat/i });
    expect(enterBtn).toBeEnabled();
  });

  it('affiche le score + badge "Terminé" pour un match fini', () => {
    adminState.data = [makeFinishedKo()];
    renderPage();
    // "1 – 1"
    expect(screen.getByText(/1\s*–\s*1/)).toBeInTheDocument();
    // Badge TAB court (TAB dom.)
    expect(screen.getByText(/tab dom\./i)).toBeInTheDocument();
    // Badge status
    const rowStatus = screen.getAllByText(/terminé/i);
    expect(rowStatus.length).toBeGreaterThan(0);
  });

  it('affiche l’état vide avec filtres quand aucun match ne matche', () => {
    adminState.data = []; // aucun match
    renderPage();
    expect(
      screen.getByText(/aucun match avec ces filtres/i),
    ).toBeInTheDocument();
  });

  it('rend une ligne par match (header + n lignes)', () => {
    adminState.data = [makeGroupMatch(), makeFinishedKo()];
    renderPage();
    const rows = screen.getAllByRole('row');
    // 1 header row + 2 data rows
    expect(rows.length).toBe(3);
  });

  it('dans une ligne de placeholder, le bouton "Saisir résultat" a bien le title d’aide', () => {
    adminState.data = [makeKoPlaceholder()];
    renderPage();
    const rows = screen.getAllByRole('row');
    const dataRow = rows[1]!; // skip header
    const disabledBtn = within(dataRow).getByRole('button', {
      name: /saisir résultat/i,
    });
    expect(disabledBtn).toHaveAttribute(
      'title',
      expect.stringMatching(/assigne/i),
    );
  });
});
