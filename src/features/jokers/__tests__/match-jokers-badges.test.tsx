import { render, screen, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IncomingChallengeRow } from '@/features/jokers/api';
import { MatchJokersBadges } from '@/features/jokers/match-jokers-badges';
import type { UserJokerWithCatalog } from '@/features/jokers/schemas';
import { i18n } from '@/i18n';

/**
 * Tests de rendu de `<MatchJokersBadges />` (Sprint 8.C.1).
 *
 * Mocks :
 *   - `use-jokers` : on pilote `useBoussoleScoreQuery` via un state partagé
 *     (`vi.hoisted`) pour simuler loading / data / null. On spy aussi sur
 *     les arguments du hook pour vérifier le gating par `enabled`.
 *
 * Invariants couverts :
 *   - retour `null` si usedByMe et incomingChallenges sont vides,
 *   - badges multiplier ×2 / ×3 (`double` / `triple`),
 *   - badge `safety_net`,
 *   - badge `boussole` dans ses 3 états (loading / result / empty),
 *   - badge challenge + double_down avec "from" name et fallback,
 *   - lecture de `stakes` depuis `used_payload` avec fallback par code,
 *   - attribut `role="list"` + aria-label i18n,
 *   - attribut `data-joker-code` sur chaque badge,
 *   - gating de la RPC boussole via `enabled=false` si pas de boussole consommée.
 */

// ------------------------------------------------------------------
//  Mocks
// ------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  return {
    boussoleState: {
      data: null as
        | { score_a: number; score_b: number; count: number }
        | null,
      isLoading: false,
    },
    boussoleSpy: vi.fn(),
  };
});

vi.mock('@/features/jokers/use-jokers', () => ({
  useBoussoleScoreQuery: (
    concoursId: string | undefined,
    matchId: string | undefined,
    options: { enabled?: boolean } = {},
  ) => {
    mocks.boussoleSpy(concoursId, matchId, options);
    return {
      data: mocks.boussoleState.data,
      isLoading: mocks.boussoleState.isLoading,
    };
  },
}));

// ------------------------------------------------------------------
//  Factories
// ------------------------------------------------------------------

const USER = '11111111-1111-1111-1111-111111111111';
const CONCOURS = '22222222-2222-2222-2222-222222222222';
const MATCH = '33333333-3333-3333-3333-333333333333';

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
    used_at: '2026-04-24T12:00:00Z',
    used_on_match_id: MATCH,
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

const makeChallenge = (
  over: Partial<IncomingChallengeRow> & { id: string },
): IncomingChallengeRow => ({
  id: over.id,
  joker_code: 'challenge',
  joker_category: 'challenge',
  used_on_match_id: MATCH,
  used_at: '2026-04-25T10:00:00Z',
  used_payload: { stakes: 5 },
  from_user_id: '99999999-9999-9999-9999-999999999999',
  from_prenom: 'Alice',
  from_nom: 'Martin',
  from_avatar_url: null,
  ...over,
});

// ------------------------------------------------------------------
//  Setup
// ------------------------------------------------------------------

beforeAll(async () => {
  await i18n.changeLanguage('fr');
});

beforeEach(() => {
  mocks.boussoleState.data = null;
  mocks.boussoleState.isLoading = false;
  mocks.boussoleSpy.mockReset();
});

// ------------------------------------------------------------------
//  Tests
// ------------------------------------------------------------------

describe('<MatchJokersBadges />', () => {
  it('retourne null si usedByMe ET incomingChallenges sont vides', () => {
    const { container } = render(
      <MatchJokersBadges
        usedByMe={[]}
        incomingChallenges={[]}
        concoursId={CONCOURS}
        matchId={MATCH}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('rend un role="list" avec aria-label i18n', () => {
    render(
      <MatchJokersBadges
        usedByMe={[makeSlot({ id: 'slot-double', joker_code: 'double' })]}
        incomingChallenges={[]}
        concoursId={CONCOURS}
        matchId={MATCH}
      />,
    );
    const list = screen.getByRole('list', {
      name: /effets jokers actifs sur ce match/i,
    });
    expect(list).toBeInTheDocument();
  });

  it('badge `double` → affiche "×2 points" avec data-joker-code="double"', () => {
    render(
      <MatchJokersBadges
        usedByMe={[makeSlot({ id: 'slot-d', joker_code: 'double' })]}
        incomingChallenges={[]}
        concoursId={CONCOURS}
        matchId={MATCH}
      />,
    );
    const list = screen.getByRole('list');
    const item = within(list).getByRole('listitem');
    expect(item).toHaveAttribute('data-joker-code', 'double');
    expect(item).toHaveTextContent(/×2 points/);
  });

  it('badge `triple` → affiche "×3 points" avec data-joker-code="triple"', () => {
    render(
      <MatchJokersBadges
        usedByMe={[makeSlot({ id: 'slot-t', joker_code: 'triple' })]}
        incomingChallenges={[]}
        concoursId={CONCOURS}
        matchId={MATCH}
      />,
    );
    const item = within(screen.getByRole('list')).getByRole('listitem');
    expect(item).toHaveAttribute('data-joker-code', 'triple');
    expect(item).toHaveTextContent(/×3 points/);
  });

  it('badge `safety_net` → affiche "Filet de sécurité"', () => {
    render(
      <MatchJokersBadges
        usedByMe={[makeSlot({ id: 'slot-s', joker_code: 'safety_net' })]}
        incomingChallenges={[]}
        concoursId={CONCOURS}
        matchId={MATCH}
      />,
    );
    const item = within(screen.getByRole('list')).getByRole('listitem');
    expect(item).toHaveAttribute('data-joker-code', 'safety_net');
    expect(item).toHaveTextContent(/filet de sécurité/i);
  });

  it('badge `boussole` en état loading → affiche "Boussole : chargement…"', () => {
    mocks.boussoleState.isLoading = true;
    mocks.boussoleState.data = null;
    render(
      <MatchJokersBadges
        usedByMe={[makeSlot({ id: 'slot-b', joker_code: 'boussole' })]}
        incomingChallenges={[]}
        concoursId={CONCOURS}
        matchId={MATCH}
      />,
    );
    const item = within(screen.getByRole('list')).getByRole('listitem');
    expect(item).toHaveAttribute('data-joker-code', 'boussole');
    expect(item).toHaveTextContent(/chargement/i);
  });

  it('badge `boussole` avec résultat → affiche "Boussole : 2-1 (5×)"', () => {
    mocks.boussoleState.isLoading = false;
    mocks.boussoleState.data = { score_a: 2, score_b: 1, count: 5 };
    render(
      <MatchJokersBadges
        usedByMe={[makeSlot({ id: 'slot-b', joker_code: 'boussole' })]}
        incomingChallenges={[]}
        concoursId={CONCOURS}
        matchId={MATCH}
      />,
    );
    const item = within(screen.getByRole('list')).getByRole('listitem');
    expect(item).toHaveTextContent(/2-1/);
    expect(item).toHaveTextContent(/5×/);
  });

  it('badge `boussole` avec data null → affiche "aucun prono"', () => {
    mocks.boussoleState.isLoading = false;
    mocks.boussoleState.data = null;
    render(
      <MatchJokersBadges
        usedByMe={[makeSlot({ id: 'slot-b', joker_code: 'boussole' })]}
        incomingChallenges={[]}
        concoursId={CONCOURS}
        matchId={MATCH}
      />,
    );
    const item = within(screen.getByRole('list')).getByRole('listitem');
    expect(item).toHaveTextContent(/aucun prono/i);
  });

  it('badge challenge reçu → "Défié par {Alice Martin} · 5 pts en jeu"', () => {
    render(
      <MatchJokersBadges
        usedByMe={[]}
        incomingChallenges={[makeChallenge({ id: 'ch-1' })]}
        concoursId={CONCOURS}
        matchId={MATCH}
      />,
    );
    const item = within(screen.getByRole('list')).getByRole('listitem');
    expect(item).toHaveAttribute('data-joker-code', 'challenge');
    expect(item).toHaveTextContent(/défié par alice martin/i);
    expect(item).toHaveTextContent(/5 pts/);
  });

  it('badge double_down reçu → "Double Down de {Alice Martin} · 10 pts en jeu"', () => {
    render(
      <MatchJokersBadges
        usedByMe={[]}
        incomingChallenges={[
          makeChallenge({
            id: 'ch-dd',
            joker_code: 'double_down',
            used_payload: { stakes: 10 },
          }),
        ]}
        concoursId={CONCOURS}
        matchId={MATCH}
      />,
    );
    const item = within(screen.getByRole('list')).getByRole('listitem');
    expect(item).toHaveAttribute('data-joker-code', 'double_down');
    expect(item).toHaveTextContent(/double down/i);
    expect(item).toHaveTextContent(/10 pts/);
  });

  it('fallback "un autre joueur" si prenom ET nom sont null', () => {
    render(
      <MatchJokersBadges
        usedByMe={[]}
        incomingChallenges={[
          makeChallenge({
            id: 'ch-anon',
            from_prenom: null,
            from_nom: null,
          }),
        ]}
        concoursId={CONCOURS}
        matchId={MATCH}
      />,
    );
    const item = within(screen.getByRole('list')).getByRole('listitem');
    expect(item).toHaveTextContent(/un autre joueur/i);
  });

  it('lit stakes depuis used_payload (valeur custom 7)', () => {
    render(
      <MatchJokersBadges
        usedByMe={[]}
        incomingChallenges={[
          makeChallenge({
            id: 'ch-7',
            used_payload: { stakes: 7 },
          }),
        ]}
        concoursId={CONCOURS}
        matchId={MATCH}
      />,
    );
    expect(
      within(screen.getByRole('list')).getByRole('listitem'),
    ).toHaveTextContent(/7 pts/);
  });

  it('fallback stakes=5 pour challenge si payload null', () => {
    render(
      <MatchJokersBadges
        usedByMe={[]}
        incomingChallenges={[
          makeChallenge({
            id: 'ch-null',
            used_payload: null,
          }),
        ]}
        concoursId={CONCOURS}
        matchId={MATCH}
      />,
    );
    expect(
      within(screen.getByRole('list')).getByRole('listitem'),
    ).toHaveTextContent(/5 pts/);
  });

  it('fallback stakes=10 pour double_down si payload null', () => {
    render(
      <MatchJokersBadges
        usedByMe={[]}
        incomingChallenges={[
          makeChallenge({
            id: 'ch-null-dd',
            joker_code: 'double_down',
            used_payload: null,
          }),
        ]}
        concoursId={CONCOURS}
        matchId={MATCH}
      />,
    );
    expect(
      within(screen.getByRole('list')).getByRole('listitem'),
    ).toHaveTextContent(/10 pts/);
  });

  it('rend plusieurs badges dans l ordre (double + safety_net + challenge)', () => {
    render(
      <MatchJokersBadges
        usedByMe={[
          makeSlot({ id: 'slot-d', joker_code: 'double' }),
          makeSlot({ id: 'slot-s', joker_code: 'safety_net' }),
        ]}
        incomingChallenges={[makeChallenge({ id: 'ch-1' })]}
        concoursId={CONCOURS}
        matchId={MATCH}
      />,
    );
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]?.getAttribute('data-joker-code')).toBe('double');
    expect(items[1]?.getAttribute('data-joker-code')).toBe('safety_net');
    expect(items[2]?.getAttribute('data-joker-code')).toBe('challenge');
  });

  it('gate RPC boussole : enabled=true si boussole consommée', () => {
    render(
      <MatchJokersBadges
        usedByMe={[makeSlot({ id: 'slot-b', joker_code: 'boussole' })]}
        incomingChallenges={[]}
        concoursId={CONCOURS}
        matchId={MATCH}
      />,
    );
    expect(mocks.boussoleSpy).toHaveBeenCalledWith(
      CONCOURS,
      MATCH,
      expect.objectContaining({ enabled: true }),
    );
  });

  it('gate RPC boussole : enabled=false si pas de boussole dans usedByMe', () => {
    render(
      <MatchJokersBadges
        usedByMe={[makeSlot({ id: 'slot-d', joker_code: 'double' })]}
        incomingChallenges={[]}
        concoursId={CONCOURS}
        matchId={MATCH}
      />,
    );
    expect(mocks.boussoleSpy).toHaveBeenCalledWith(
      CONCOURS,
      MATCH,
      expect.objectContaining({ enabled: false }),
    );
  });

  it('codes non-affichables (challenge en usedByMe, gift, inconnu) → filtrés', () => {
    render(
      <MatchJokersBadges
        usedByMe={[
          makeSlot({ id: 'slot-g', joker_code: 'gift' }),
          makeSlot({ id: 'slot-unknown', joker_code: 'some_future_code' }),
          makeSlot({ id: 'slot-d', joker_code: 'double' }),
        ]}
        incomingChallenges={[]}
        concoursId={CONCOURS}
        matchId={MATCH}
      />,
    );
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    // Seul `double` est un code d'affichage côté "usedByMe" — gift et le
    // code inconnu sont filtrés par le `switch`/`default => null`.
    expect(items).toHaveLength(1);
    expect(items[0]?.getAttribute('data-joker-code')).toBe('double');
  });
});
