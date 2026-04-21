import { render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests de rendu du `MatchCard`.
 *
 * On ne teste pas ici l'auto-save debouncée (timers + async mutation
 * sont couverts par les tests de schemas + api + par les hooks directement).
 * On valide les invariants UX :
 *   - rendu des équipes + phase + label de groupe,
 *   - verrouillage au coup d'envoi (Lock badge + inputs disabled),
 *   - apparition conditionnelle des radios "vainqueur aux tirs au but"
 *     (phase KO + égalité uniquement),
 *   - bouton "Effacer mon prono" visible seulement si un prono existe
 *     et que le match n'est pas verrouillé.
 */

// Les hooks TanStack Query sont remplacés par des stubs pour éviter
// d'avoir à monter un QueryClientProvider et un client Supabase.
vi.mock('@/features/pronos/use-pronos', () => ({
  useUpsertPronoMutation: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  }),
  useDeletePronoMutation: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  }),
}));

import type { Prono, ResolvedMatchWithEquipes } from '@/features/pronos/api';
import { MatchCard } from '@/features/pronos/components/match-card';
import { i18n } from '@/i18n';

const CONCOURS = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';
const MATCH = '33333333-3333-3333-3333-333333333333';

const EQUIPE_A = {
  id: 'a',
  code: 'FRA',
  nom: 'France',
  groupe: 'A',
  drapeau_url: null,
} as const;

const EQUIPE_B = {
  id: 'b',
  code: 'GER',
  nom: 'Allemagne',
  groupe: 'A',
  drapeau_url: null,
} as const;

const makeMatch = (
  overrides: Partial<ResolvedMatchWithEquipes> = {},
): ResolvedMatchWithEquipes => {
  return {
    id: MATCH,
    competition_id: 'c',
    equipe_a_id: 'a',
    equipe_b_id: 'b',
    phase: 'groupes',
    round: 1,
    kick_off_at: '2099-06-11T18:00:00Z', // futur
    score_a: null,
    score_b: null,
    vainqueur_tab: null,
    penalty_score_a: null,
    penalty_score_b: null,
    status: 'scheduled',
    venue_name: 'Stade Pierre Mauroy',
    fifa_match_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    equipe_a: EQUIPE_A,
    equipe_b: EQUIPE_B,
    cote_a: null,
    cote_b: null,
    cote_nul: null,
    ...overrides,
  } as ResolvedMatchWithEquipes;
};

const makeProno = (overrides: Partial<Prono> = {}): Prono => ({
  concours_id: CONCOURS,
  user_id: USER,
  match_id: MATCH,
  score_a: 1,
  score_b: 0,
  vainqueur_tab: null,
  created_at: '2026-06-11T00:00:00Z',
  updated_at: '2026-06-11T00:00:00Z',
  ...overrides,
});

beforeAll(async () => {
  // Force le FR pour que les assertions sur le texte soient stables.
  // Le détecteur de langue sinon retombe sur l'anglais de jsdom.
  await i18n.changeLanguage('fr');
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('<MatchCard />', () => {
  it('affiche le nom des deux équipes et la phase', () => {
    render(
      <MatchCard
        match={makeMatch()}
        existing={undefined}
        concoursId={CONCOURS}
        userId={USER}
      />,
    );
    expect(screen.getByText('France')).toBeInTheDocument();
    expect(screen.getByText('Allemagne')).toBeInTheDocument();
    // phase "groupes" → label i18n FR "Phase de groupes"
    expect(screen.getByText(/phase de groupes/i)).toBeInTheDocument();
  });

  it('affiche le label de groupe (A → "Groupe A")', () => {
    render(
      <MatchCard
        match={makeMatch()}
        existing={undefined}
        concoursId={CONCOURS}
        userId={USER}
      />,
    );
    expect(screen.getByText(/groupe a/i)).toBeInTheDocument();
  });

  it('verrouille la carte quand le coup d’envoi est passé', () => {
    const pastMatch = makeMatch({ kick_off_at: '2000-01-01T00:00:00Z' });
    render(
      <MatchCard
        match={pastMatch}
        existing={undefined}
        concoursId={CONCOURS}
        userId={USER}
      />,
    );
    // Le badge "Verrouillé" est visible (clé i18n FR).
    const locked = screen.getAllByText(/verrouillé/i);
    expect(locked.length).toBeGreaterThan(0);

    // Les deux inputs score sont disabled.
    const scoreInputs = screen.getAllByRole('spinbutton');
    expect(scoreInputs).toHaveLength(2);
    scoreInputs.forEach((input) => {
      expect(input).toBeDisabled();
    });
  });

  it('n’affiche pas le fieldset "vainqueur aux tirs au but" en phase de groupes', () => {
    render(
      <MatchCard
        match={makeMatch({ phase: 'groupes' })}
        existing={undefined}
        concoursId={CONCOURS}
        userId={USER}
      />,
    );
    expect(screen.queryByText(/tirs au but/i)).not.toBeInTheDocument();
  });

  it('affiche le fieldset "vainqueur aux tirs au but" en phase KO + égalité (défaut 0-0)', () => {
    render(
      <MatchCard
        match={makeMatch({ phase: 'huitiemes' })}
        existing={undefined}
        concoursId={CONCOURS}
        userId={USER}
      />,
    );
    expect(screen.getByText(/tirs au but/i)).toBeInTheDocument();
    // Deux radios (un par équipe).
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
  });

  it('masque le fieldset TAB si score KO non nul différent', () => {
    render(
      <MatchCard
        match={makeMatch({ phase: 'huitiemes' })}
        existing={makeProno({ score_a: 2, score_b: 1 })}
        concoursId={CONCOURS}
        userId={USER}
      />,
    );
    expect(screen.queryByText(/tirs au but/i)).not.toBeInTheDocument();
  });

  it('affiche le bouton "Effacer mon prono" si un prono existe et match non verrouillé', () => {
    render(
      <MatchCard
        match={makeMatch()}
        existing={makeProno()}
        concoursId={CONCOURS}
        userId={USER}
      />,
    );
    expect(
      screen.getByRole('button', { name: /effacer mon prono/i }),
    ).toBeInTheDocument();
  });

  it('ne montre PAS le bouton "Effacer" si aucun prono', () => {
    render(
      <MatchCard
        match={makeMatch()}
        existing={undefined}
        concoursId={CONCOURS}
        userId={USER}
      />,
    );
    expect(
      screen.queryByRole('button', { name: /effacer mon prono/i }),
    ).not.toBeInTheDocument();
  });

  it('ne montre PAS le bouton "Effacer" si le match est verrouillé', () => {
    render(
      <MatchCard
        match={makeMatch({ kick_off_at: '2000-01-01T00:00:00Z' })}
        existing={makeProno()}
        concoursId={CONCOURS}
        userId={USER}
      />,
    );
    expect(
      screen.queryByRole('button', { name: /effacer mon prono/i }),
    ).not.toBeInTheDocument();
  });
});
