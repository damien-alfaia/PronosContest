import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConcoursClassementPage } from '@/features/classement/concours-classement-page';
import { i18n } from '@/i18n';

/**
 * Tests de rendu de `ConcoursClassementPage`.
 *
 * On mocke :
 *   - `use-classement` pour piloter le state (loading / data).
 *   - `use-concours` pour fournir un `concours` avec / sans le user
 *     comme participant.
 *   - `@/hooks/use-auth` pour fournir un user id stable.
 *
 * On n'utilise PAS un QueryClientProvider réel : tous les hooks sont
 * remplacés par des stubs. Le useRealtime est un no-op dans le mock.
 */

const CONCOURS = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';
const OTHER = '33333333-3333-3333-3333-333333333333';

// ---------- Mocks partagés ----------

type DetailState = {
  isLoading: boolean;
  isError: boolean;
  data:
    | {
        id: string;
        nom: string;
        competition: { nom: string } | null;
        participants: Array<{ user_id: string }>;
      }
    | null;
};

type ClassementState = {
  isLoading: boolean;
  data: Array<{
    concours_id: string;
    user_id: string;
    rang: number;
    points: number;
    prono_points: number;
    challenge_delta: number;
    pronos_joues: number;
    pronos_gagnes: number;
    pronos_exacts: number;
    prenom: string | null;
    nom: string | null;
    avatar_url: string | null;
  }>;
};

const detailState: DetailState = {
  isLoading: false,
  isError: false,
  data: null,
};
const classementState: ClassementState = { isLoading: false, data: [] };

vi.mock('@/features/concours/use-concours', () => ({
  useConcoursDetailQuery: () => ({
    isLoading: detailState.isLoading,
    isError: detailState.isError,
    data: detailState.data,
  }),
}));

vi.mock('@/features/classement/use-classement', () => ({
  useClassementQuery: () => ({
    isLoading: classementState.isLoading,
    data: classementState.data,
  }),
  useClassementRealtime: () => undefined,
}));

// Stub onboarding hook utilisé pour le milestone first_classement_viewed_at.
// Pas besoin de QueryClient : on retourne un mutation-like inerte.
vi.mock('@/features/onboarding/use-onboarding', () => ({
  useMarkFirstClassementViewedMutation: () => ({
    mutate: () => undefined,
    isPending: false,
  }),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: USER } }),
}));

// L'import de la page doit venir APRÈS les vi.mock().

const renderPage = (initialPath = `/app/concours/${CONCOURS}/classement`) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/app/concours/:id/classement"
          element={<ConcoursClassementPage />}
        />
        <Route path="/app/concours/:id" element={<div>concours-fiche</div>} />
        <Route path="/app/concours" element={<div>concours-liste</div>} />
      </Routes>
    </MemoryRouter>,
  );

const setConcours = (isMember: boolean) => {
  detailState.isLoading = false;
  detailState.isError = false;
  detailState.data = {
    id: CONCOURS,
    nom: 'Pronos entre potes',
    competition: { nom: 'WC 2026' },
    participants: isMember
      ? [{ user_id: USER }, { user_id: OTHER }]
      : [{ user_id: OTHER }],
  };
};

beforeAll(async () => {
  await i18n.changeLanguage('fr');
});

beforeEach(() => {
  detailState.isLoading = false;
  detailState.isError = false;
  detailState.data = null;
  classementState.isLoading = false;
  classementState.data = [];
});

// ------------------------------------------------------------------
//  Guards
// ------------------------------------------------------------------

describe('<ConcoursClassementPage /> guards', () => {
  it('redirige vers la liste si le concours est introuvable', () => {
    detailState.isError = true;
    detailState.data = null;
    renderPage();
    expect(screen.getByText('concours-liste')).toBeInTheDocument();
  });

  it("redirige vers la fiche du concours si l'utilisateur n'est pas membre", () => {
    setConcours(false);
    renderPage();
    expect(screen.getByText('concours-fiche')).toBeInTheDocument();
  });
});

// ------------------------------------------------------------------
//  Rendu
// ------------------------------------------------------------------

describe('<ConcoursClassementPage /> rendu', () => {
  it('affiche le titre + nom du concours + compétition', () => {
    setConcours(true);
    renderPage();
    expect(screen.getByRole('heading', { name: /classement/i })).toBeInTheDocument();
    expect(screen.getByText(/pronos entre potes/i)).toBeInTheDocument();
    expect(screen.getByText(/wc 2026/i)).toBeInTheDocument();
  });

  it('affiche un état vide quand aucun participant', () => {
    setConcours(true);
    classementState.data = [];
    renderPage();
    expect(screen.getByText(/classement vide/i)).toBeInTheDocument();
  });

  it('rend les lignes triées par rang + met en évidence ma ligne', () => {
    setConcours(true);
    classementState.data = [
      {
        concours_id: CONCOURS,
        user_id: USER,
        rang: 1,
        points: 42,
        prono_points: 42,
        challenge_delta: 0,
        pronos_joues: 10,
        pronos_gagnes: 8,
        pronos_exacts: 3,
        prenom: 'Alice',
        nom: 'Martin',
        avatar_url: null,
      },
      {
        concours_id: CONCOURS,
        user_id: OTHER,
        rang: 2,
        points: 30,
        prono_points: 30,
        challenge_delta: 0,
        pronos_joues: 10,
        pronos_gagnes: 5,
        pronos_exacts: 1,
        prenom: 'Bob',
        nom: 'Dupont',
        avatar_url: null,
      },
    ];
    renderPage();

    // Les deux joueurs sont rendus
    expect(screen.getByText(/alice martin/i)).toBeInTheDocument();
    expect(screen.getByText(/bob dupont/i)).toBeInTheDocument();

    // La ligne "moi" a l'aria-label dédié
    const meRow = screen.getByRole('row', { name: /ta ligne/i });
    // Dans cette ligne, on doit retrouver "Alice Martin" (user = Alice)
    expect(within(meRow).getByText(/alice martin/i)).toBeInTheDocument();

    // Le badge "Toi" est visible à côté du nom
    expect(screen.getByText(/^toi$/i)).toBeInTheDocument();
  });

  it('affiche la bannière "Ma position" avec points + exacts + gagnés', () => {
    setConcours(true);
    classementState.data = [
      {
        concours_id: CONCOURS,
        user_id: USER,
        rang: 1,
        points: 81,
        prono_points: 81,
        challenge_delta: 0,
        pronos_joues: 3,
        pronos_gagnes: 3,
        pronos_exacts: 2,
        prenom: 'Alice',
        nom: 'Martin',
        avatar_url: null,
      },
    ];
    renderPage();

    expect(screen.getByText(/ma position/i)).toBeInTheDocument();
    // Pattern "81 pts · 2 exact(s) · 3 gagné(s)"
    expect(screen.getByText(/81 pts/i)).toBeInTheDocument();
    expect(screen.getByText(/2 exact/i)).toBeInTheDocument();
    expect(screen.getByText(/3 gagn/i)).toBeInTheDocument();
  });

  it('affiche initiales de fallback quand pas d’avatar', () => {
    setConcours(true);
    classementState.data = [
      {
        concours_id: CONCOURS,
        user_id: USER,
        rang: 1,
        points: 0,
        prono_points: 0,
        challenge_delta: 0,
        pronos_joues: 0,
        pronos_gagnes: 0,
        pronos_exacts: 0,
        prenom: 'Alice',
        nom: 'Martin',
        avatar_url: null,
      },
    ];
    renderPage();
    // Radix Avatar n'affiche le fallback que lorsque l'image échoue :
    // comme on n'a pas d'image du tout, le fallback apparaît en DOM.
    expect(screen.getByText('AM')).toBeInTheDocument();
  });

  it('tombe sur "?" quand prenom et nom sont null', () => {
    setConcours(true);
    classementState.data = [
      {
        concours_id: CONCOURS,
        user_id: USER,
        rang: 1,
        points: 0,
        prono_points: 0,
        challenge_delta: 0,
        pronos_joues: 0,
        pronos_gagnes: 0,
        pronos_exacts: 0,
        prenom: null,
        nom: null,
        avatar_url: null,
      },
    ];
    renderPage();
    expect(screen.getByText('?')).toBeInTheDocument();
  });
});

// ------------------------------------------------------------------
//  Décomposition prono_points + challenge_delta (Sprint 8.C.2)
// ------------------------------------------------------------------

describe('<ConcoursClassementPage /> décomposition jokers', () => {
  it('affiche un badge challenge_delta positif sur la bannière "Ma position"', () => {
    setConcours(true);
    classementState.data = [
      {
        concours_id: CONCOURS,
        user_id: USER,
        rang: 1,
        points: 55,
        prono_points: 45,
        challenge_delta: 10,
        pronos_joues: 8,
        pronos_gagnes: 6,
        pronos_exacts: 2,
        prenom: 'Alice',
        nom: 'Martin',
        avatar_url: null,
      },
    ];
    renderPage();

    // Bannière "Ma position" contient bien le delta signé
    expect(screen.getByText(/challenges\s*:\s*\+10/i)).toBeInTheDocument();
  });

  it('affiche un badge challenge_delta négatif sur la bannière "Ma position"', () => {
    setConcours(true);
    classementState.data = [
      {
        concours_id: CONCOURS,
        user_id: USER,
        rang: 2,
        points: 20,
        prono_points: 25,
        challenge_delta: -5,
        pronos_joues: 5,
        pronos_gagnes: 3,
        pronos_exacts: 1,
        prenom: 'Alice',
        nom: 'Martin',
        avatar_url: null,
      },
    ];
    renderPage();

    // Signe "-" déjà intégré au nombre côté int → pas de "+"
    expect(screen.getByText(/challenges\s*:\s*-5/i)).toBeInTheDocument();
  });

  it('masque le badge challenge_delta sur la bannière quand delta = 0', () => {
    setConcours(true);
    classementState.data = [
      {
        concours_id: CONCOURS,
        user_id: USER,
        rang: 1,
        points: 30,
        prono_points: 30,
        challenge_delta: 0,
        pronos_joues: 5,
        pronos_gagnes: 4,
        pronos_exacts: 2,
        prenom: 'Alice',
        nom: 'Martin',
        avatar_url: null,
      },
    ];
    renderPage();

    expect(screen.getByText(/ma position/i)).toBeInTheDocument();
    // Aucun badge "Challenges : …" ne doit apparaître.
    expect(screen.queryByText(/challenges\s*:/i)).not.toBeInTheDocument();
  });

  it('affiche la colonne "Détail" avec prono_points + delta signé', () => {
    setConcours(true);
    classementState.data = [
      {
        concours_id: CONCOURS,
        user_id: USER,
        rang: 1,
        points: 40,
        prono_points: 45,
        challenge_delta: -5,
        pronos_joues: 6,
        pronos_gagnes: 5,
        pronos_exacts: 2,
        prenom: 'Alice',
        nom: 'Martin',
        avatar_url: null,
      },
    ];
    renderPage();

    // En-tête de colonne "Détail"
    expect(
      screen.getByRole('columnheader', { name: /détail/i }),
    ).toBeInTheDocument();

    // La ligne "Ta ligne" contient prono_points=45 et le delta signé -5.
    const meRow = screen.getByRole('row', { name: /ta ligne/i });
    // prono_points brut
    expect(within(meRow).getByText('45')).toBeInTheDocument();
    // badge delta signé — le signe "-" est déjà inclus dans la String
    expect(within(meRow).getByText('-5')).toBeInTheDocument();
  });

  it('affiche "±0" dans la colonne Détail quand challenge_delta = 0', () => {
    setConcours(true);
    classementState.data = [
      {
        concours_id: CONCOURS,
        user_id: USER,
        rang: 1,
        points: 40,
        prono_points: 40,
        challenge_delta: 0,
        pronos_joues: 5,
        pronos_gagnes: 4,
        pronos_exacts: 2,
        prenom: 'Alice',
        nom: 'Martin',
        avatar_url: null,
      },
    ];
    renderPage();

    const meRow = screen.getByRole('row', { name: /ta ligne/i });
    // Placeholder ±0 pour les users sans interaction challenge
    expect(within(meRow).getByText('±0')).toBeInTheDocument();
  });

  it('préserve le signe + sur un delta challenge positif côté colonne Détail', () => {
    setConcours(true);
    classementState.data = [
      {
        concours_id: CONCOURS,
        user_id: USER,
        rang: 1,
        points: 55,
        prono_points: 45,
        challenge_delta: 10,
        pronos_joues: 6,
        pronos_gagnes: 5,
        pronos_exacts: 2,
        prenom: 'Alice',
        nom: 'Martin',
        avatar_url: null,
      },
    ];
    renderPage();

    const meRow = screen.getByRole('row', { name: /ta ligne/i });
    // Badge affiche "+10" (pas "10")
    expect(within(meRow).getByText('+10')).toBeInTheDocument();
  });
});

