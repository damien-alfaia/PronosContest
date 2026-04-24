import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyStateIllustrated } from '@/components/common/empty-state-illustrated';

/**
 * Tests de rendu du composant `<EmptyStateIllustrated />`.
 *
 * Invariants couverts :
 *   - rendu du titre (toujours)
 *   - rendu de la description (optionnelle)
 *   - rendu de l'action (slot custom)
 *   - aria-label hérité du title
 *   - role="status" présent pour les lecteurs d'écran
 *   - les 5 illustrations se rendent toutes sans crasher
 *   - la className optionnelle est propagée au conteneur racine
 *   - les tailles sm/md/lg modifient bien les classes d'illustration
 */

describe('<EmptyStateIllustrated />', () => {
  it('rend le titre', () => {
    render(<EmptyStateIllustrated illustration="pronos" title="Aucun prono" />);
    expect(screen.getByText('Aucun prono')).toBeInTheDocument();
  });

  it('rend la description quand fournie', () => {
    render(
      <EmptyStateIllustrated
        illustration="pronos"
        title="Titre"
        description="Descriptif long expliquant la situation"
      />,
    );
    expect(
      screen.getByText('Descriptif long expliquant la situation'),
    ).toBeInTheDocument();
  });

  it('ne rend pas de <p> description si elle est absente', () => {
    const { container } = render(
      <EmptyStateIllustrated illustration="pronos" title="Titre seul" />,
    );
    // Il doit y avoir 1 seul <p> (le titre est un <p>, la description
    // un <p> aussi si présente).
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]?.textContent).toBe('Titre seul');
  });

  it("rend l'action dans un slot dédié", () => {
    render(
      <EmptyStateIllustrated
        illustration="concours"
        title="Rien"
        action={<button type="button">Agir</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Agir' })).toBeInTheDocument();
  });

  it('expose role="status" + aria-label pour l\'accessibilité', () => {
    render(
      <EmptyStateIllustrated illustration="chat" title="Pas de message" />,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-label', 'Pas de message');
  });

  it.each([
    ['pronos' as const],
    ['concours' as const],
    ['classement' as const],
    ['notifications' as const],
    ['chat' as const],
  ])("rend l'illustration %s sans erreur", (illustration) => {
    const { container } = render(
      <EmptyStateIllustrated illustration={illustration} title="Ok" />,
    );
    // Chaque illustration est un SVG inline
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('propage la className au conteneur racine', () => {
    const { container } = render(
      <EmptyStateIllustrated
        illustration="pronos"
        title="T"
        className="custom-class"
      />,
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it("applique la bonne classe de taille sur l'illustration", () => {
    const { rerender, container } = render(
      <EmptyStateIllustrated illustration="pronos" title="T" size="sm" />,
    );
    expect(container.querySelector('.h-20.w-20')).toBeInTheDocument();

    rerender(
      <EmptyStateIllustrated illustration="pronos" title="T" size="lg" />,
    );
    expect(container.querySelector('.h-40.w-40')).toBeInTheDocument();
  });
});
