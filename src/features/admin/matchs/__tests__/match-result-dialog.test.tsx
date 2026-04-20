import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests du `MatchResultDialog`.
 *
 * On mocke :
 *   - `useUpdateMatchResultMutation` → capture les appels.
 *   - `sonner` → toasts muets.
 *
 * Invariants couverts :
 *   - titre + équipes affichés en header,
 *   - fieldset "Vainqueur aux TAB" caché en phase de groupes,
 *   - fieldset affiché en phase KO quand les scores sont égaux,
 *   - fieldset masqué en phase KO quand les scores sont différents,
 *   - clic sur "Valider" déclenche mutate avec status='finished',
 *   - clic sur "Enregistrer en live" déclenche mutate avec status='live'.
 */

const MATCH = '11111111-0000-0000-0000-000000000001';
const COMP = '22222222-0000-0000-0000-000000000001';

const mutateSpy = vi.fn();

vi.mock('@/features/admin/matchs/use-admin-matchs', () => ({
  useUpdateMatchResultMutation: () => ({
    mutate: mutateSpy,
    isPending: false,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import type { AdminMatchRow } from '@/features/admin/matchs/api';
import { MatchResultDialog } from '@/features/admin/matchs/components/match-result-dialog';
import { i18n } from '@/i18n';

const makeMatch = (overrides: Partial<AdminMatchRow> = {}): AdminMatchRow =>
  ({
    id: MATCH,
    competition_id: COMP,
    phase: 'groupes',
    equipe_a_id: 'eq-a',
    equipe_b_id: 'eq-b',
    kick_off_at: '2099-06-11T18:00:00Z',
    status: 'scheduled',
    score_a: null,
    score_b: null,
    vainqueur_tab: null,
    penalty_score_a: null,
    penalty_score_b: null,
    round: null,
    cote_a: null,
    cote_b: null,
    cote_nul: null,
    fifa_match_id: null,
    stade: null,
    ville: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    equipe_a: {
      id: 'eq-a',
      code: 'FRA',
      nom: 'France',
      groupe: 'A',
      drapeau_url: null,
    },
    equipe_b: {
      id: 'eq-b',
      code: 'GER',
      nom: 'Allemagne',
      groupe: 'A',
      drapeau_url: null,
    },
    ...overrides,
  }) as AdminMatchRow;

beforeAll(async () => {
  await i18n.changeLanguage('fr');
});

beforeEach(() => {
  mutateSpy.mockReset();
});

describe('<MatchResultDialog />', () => {
  it('rend rien si open=false', () => {
    const { container } = render(
      <MatchResultDialog
        open={false}
        onOpenChange={() => undefined}
        match={makeMatch()}
        competitionId={COMP}
      />,
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('affiche le titre + les deux équipes', () => {
    render(
      <MatchResultDialog
        open={true}
        onOpenChange={() => undefined}
        match={makeMatch()}
        competitionId={COMP}
      />,
    );
    expect(
      screen.getByRole('heading', { name: /résultat du match/i }),
    ).toBeInTheDocument();
    // "France" / "Allemagne" apparaissent 2× (sous-titre + <label htmlFor>)
    // → on vérifie juste la présence.
    expect(screen.getAllByText(/france/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/allemagne/i).length).toBeGreaterThanOrEqual(1);
  });

  it('NE montre PAS le fieldset TAB en phase de groupes (même égalité)', () => {
    render(
      <MatchResultDialog
        open={true}
        onOpenChange={() => undefined}
        match={makeMatch({ phase: 'groupes', score_a: 1, score_b: 1 })}
        competitionId={COMP}
      />,
    );
    // Pas de legend "Vainqueur aux tirs au but"
    expect(
      screen.queryByText(/vainqueur aux tirs au but/i),
    ).not.toBeInTheDocument();
  });

  it('affiche le fieldset TAB en phase KO + scores égaux (default 0-0)', () => {
    render(
      <MatchResultDialog
        open={true}
        onOpenChange={() => undefined}
        match={makeMatch({ phase: 'huitiemes' })}
        competitionId={COMP}
      />,
    );
    expect(screen.getByText(/vainqueur aux tirs au but/i)).toBeInTheDocument();
    // 2 boutons à bascule (un par équipe)
    const btns = screen
      .getAllByRole('button')
      .filter((b) =>
        ['France', 'Allemagne'].includes(b.textContent?.trim() ?? ''),
      );
    expect(btns).toHaveLength(2);
  });

  it('masque le fieldset TAB en KO quand scores sont différents', () => {
    render(
      <MatchResultDialog
        open={true}
        onOpenChange={() => undefined}
        match={makeMatch({ phase: 'quarts', score_a: 2, score_b: 1 })}
        competitionId={COMP}
      />,
    );
    expect(
      screen.queryByText(/vainqueur aux tirs au but/i),
    ).not.toBeInTheDocument();
  });

  it('submit "Valider" envoie status=finished', async () => {
    render(
      <MatchResultDialog
        open={true}
        onOpenChange={() => undefined}
        match={makeMatch({ score_a: 2, score_b: 1 })}
        competitionId={COMP}
      />,
    );

    // Le bouton submit type=submit s'intitule "Valider le résultat"
    const submit = screen.getByRole('button', { name: /valider le résultat/i });
    fireEvent.click(submit);

    // `form.handleSubmit` est async (Zod resolver) → on attend le mutate.
    await waitFor(() => expect(mutateSpy).toHaveBeenCalledTimes(1));
    const payload = mutateSpy.mock.calls[0]?.[0] as { status: string };
    expect(payload.status).toBe('finished');
  });

  it('clic sur "Enregistrer en live" envoie status=live', async () => {
    render(
      <MatchResultDialog
        open={true}
        onOpenChange={() => undefined}
        match={makeMatch({ score_a: 1, score_b: 0 })}
        competitionId={COMP}
      />,
    );

    const liveBtn = screen.getByRole('button', {
      name: /enregistrer en live/i,
    });
    fireEvent.click(liveBtn);

    await waitFor(() => expect(mutateSpy).toHaveBeenCalledTimes(1));
    const payload = mutateSpy.mock.calls[0]?.[0] as { status: string };
    expect(payload.status).toBe('live');
  });
});
