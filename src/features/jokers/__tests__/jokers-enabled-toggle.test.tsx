import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { JokersEnabledToggle } from '@/features/jokers/jokers-enabled-toggle';
import { i18n } from '@/i18n';

/**
 * Tests de `<JokersEnabledToggle />`.
 *
 * Mocks :
 *   - `use-jokers` : `useSetConcoursJokersEnabledMutation` renvoie un
 *     objet contrôlable depuis un state partagé (vi.hoisted).
 *   - `sonner` : `toast.success` / `toast.error` sont spiés.
 *
 * Invariants couverts :
 *   - rendu : deux boutons `role="radio"` (on / off) reflètent `enabled`,
 *   - click sur le bouton déjà actif → mutation non appelée (no-op),
 *   - click sur l'autre bouton → mutation appelée avec (concoursId, next),
 *   - onSuccess → toast.success avec le bon message (enabled / disabled),
 *   - onError → toast.error,
 *   - `isPending` → les deux boutons sont désactivés.
 */

const CONCOURS = '22222222-2222-2222-2222-222222222222';

const mocks = vi.hoisted(() => {
  return {
    mutateSpy: vi.fn(),
    isPending: false,
    toastSuccessSpy: vi.fn(),
    toastErrorSpy: vi.fn(),
  };
});

vi.mock('@/features/jokers/use-jokers', () => ({
  useSetConcoursJokersEnabledMutation: () => ({
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
//  Setup
// ------------------------------------------------------------------

beforeAll(async () => {
  await i18n.changeLanguage('fr');
});

beforeEach(() => {
  mocks.mutateSpy.mockReset();
  mocks.isPending = false;
  mocks.toastSuccessSpy.mockReset();
  mocks.toastErrorSpy.mockReset();
});

// ------------------------------------------------------------------
//  Tests
// ------------------------------------------------------------------

describe('<JokersEnabledToggle />', () => {
  it('affiche le titre et la description enabled=false', () => {
    render(<JokersEnabledToggle concoursId={CONCOURS} enabled={false} />);
    expect(screen.getByText(/jokers & bonus/i)).toBeInTheDocument();
  });

  it('aria-checked reflète enabled=true sur le bouton "Activés"', () => {
    render(<JokersEnabledToggle concoursId={CONCOURS} enabled={true} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]?.getAttribute('aria-checked')).toBe('true');
    expect(radios[1]?.getAttribute('aria-checked')).toBe('false');
  });

  it('aria-checked reflète enabled=false sur le bouton "Désactivés"', () => {
    render(<JokersEnabledToggle concoursId={CONCOURS} enabled={false} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]?.getAttribute('aria-checked')).toBe('false');
    expect(radios[1]?.getAttribute('aria-checked')).toBe('true');
  });

  it('click sur le bouton déjà actif → mutation non appelée', () => {
    render(<JokersEnabledToggle concoursId={CONCOURS} enabled={true} />);
    const radios = screen.getAllByRole('radio');
    // Le bouton "Activés" est déjà actif
    fireEvent.click(radios[0]!);
    expect(mocks.mutateSpy).not.toHaveBeenCalled();
  });

  it('click sur l autre bouton → mutation appelée avec (concoursId, next)', () => {
    render(<JokersEnabledToggle concoursId={CONCOURS} enabled={false} />);
    const radios = screen.getAllByRole('radio');
    // Click sur "Activés" alors que enabled=false
    fireEvent.click(radios[0]!);
    expect(mocks.mutateSpy).toHaveBeenCalledTimes(1);
    expect(mocks.mutateSpy.mock.calls[0]?.[0]).toEqual({
      concoursId: CONCOURS,
      enabled: true,
    });
  });

  it('onSuccess → toast.success avec message "enabled"', () => {
    render(<JokersEnabledToggle concoursId={CONCOURS} enabled={false} />);
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]!); // enabled=true

    // Simule le callback onSuccess passé à mutate
    const onSuccess = mocks.mutateSpy.mock.calls[0]?.[1]?.onSuccess;
    onSuccess?.();

    expect(mocks.toastSuccessSpy).toHaveBeenCalledTimes(1);
    // "Jokers activés" (fr)
    expect(mocks.toastSuccessSpy.mock.calls[0]?.[0]).toMatch(/activ/i);
  });

  it('onSuccess → toast.success avec message "disabled"', () => {
    render(<JokersEnabledToggle concoursId={CONCOURS} enabled={true} />);
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[1]!); // enabled=false

    const onSuccess = mocks.mutateSpy.mock.calls[0]?.[1]?.onSuccess;
    onSuccess?.();

    expect(mocks.toastSuccessSpy).toHaveBeenCalledTimes(1);
    // "Jokers désactivés" (fr)
    expect(mocks.toastSuccessSpy.mock.calls[0]?.[0]).toMatch(/désactiv/i);
  });

  it('onError → toast.error', () => {
    render(<JokersEnabledToggle concoursId={CONCOURS} enabled={false} />);
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]!);

    const onError = mocks.mutateSpy.mock.calls[0]?.[1]?.onError;
    onError?.();

    expect(mocks.toastErrorSpy).toHaveBeenCalledTimes(1);
  });

  it('isPending=true → les deux boutons sont désactivés', () => {
    mocks.isPending = true;
    render(<JokersEnabledToggle concoursId={CONCOURS} enabled={false} />);
    const radios = screen.getAllByRole('radio');
    expect((radios[0] as HTMLButtonElement).disabled).toBe(true);
    expect((radios[1] as HTMLButtonElement).disabled).toBe(true);
  });

  it('isPending=true → click ignoré (pas d appel mutate)', () => {
    mocks.isPending = true;
    render(<JokersEnabledToggle concoursId={CONCOURS} enabled={false} />);
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]!);
    expect(mocks.mutateSpy).not.toHaveBeenCalled();
  });
});
