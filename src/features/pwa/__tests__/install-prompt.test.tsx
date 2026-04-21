import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { i18n } from '@/i18n';

import { InstallPrompt } from '@/features/pwa/install-prompt';

/**
 * Forge un faux `beforeinstallprompt`. Les propriétés custom (`prompt`,
 * `userChoice`, `platforms`) sont attachées à une `Event` standard.
 */
const makeBeforeInstallPromptEvent = (
  outcome: 'accepted' | 'dismissed' = 'accepted',
) => {
  const event = new Event('beforeinstallprompt') as Event & {
    platforms: string[];
    userChoice: Promise<{ outcome: string; platform: string }>;
    prompt: ReturnType<typeof vi.fn>;
  };
  Object.assign(event, {
    platforms: ['web'],
    userChoice: Promise.resolve({ outcome, platform: 'web' }),
    prompt: vi.fn(() => Promise.resolve()),
  });
  return event;
};

describe('<InstallPrompt />', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('fr');
  });

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('ne rend rien tant que beforeinstallprompt n\'a pas été capturé', () => {
    const { container } = render(<InstallPrompt />);
    expect(container.firstChild).toBeNull();
  });

  it('affiche le banner quand beforeinstallprompt est reçu', () => {
    render(<InstallPrompt />);

    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });

    expect(screen.getByTestId('install-prompt')).toBeInTheDocument();
    expect(screen.getByText('Installer PronosticsContest')).toBeInTheDocument();
  });

  it('déclenche prompt() quand on clique "Installer"', async () => {
    const event = makeBeforeInstallPromptEvent('accepted');
    render(<InstallPrompt />);

    act(() => {
      window.dispatchEvent(event);
    });

    const installBtn = screen.getByTestId('install-prompt-install');
    await act(async () => {
      fireEvent.click(installBtn);
      // Laisse `userChoice` se résoudre.
      await Promise.resolve();
    });

    expect(event.prompt).toHaveBeenCalledTimes(1);
  });

  it('se cache après click "Plus tard" et persiste le dismiss', () => {
    render(<InstallPrompt />);

    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });

    fireEvent.click(screen.getByText('Plus tard'));

    expect(screen.queryByTestId('install-prompt')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('pwa:install:dismissedAt')).toBeTruthy();
  });

  it('se cache aussi via le bouton X', () => {
    render(<InstallPrompt />);

    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });

    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));

    expect(screen.queryByTestId('install-prompt')).not.toBeInTheDocument();
  });

  it('ne s\'affiche pas si un dismiss récent est enregistré', () => {
    window.localStorage.setItem(
      'pwa:install:dismissedAt',
      String(Date.now()),
    );
    render(<InstallPrompt />);

    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });

    expect(screen.queryByTestId('install-prompt')).not.toBeInTheDocument();
  });

  it('s\'affiche à nouveau si le dismiss remonte à plus de 30 jours', () => {
    const oldTs = Date.now() - 31 * 24 * 60 * 60 * 1000;
    window.localStorage.setItem('pwa:install:dismissedAt', String(oldTs));

    render(<InstallPrompt />);

    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });

    expect(screen.getByTestId('install-prompt')).toBeInTheDocument();
  });

  it('se cache sur l\'event `appinstalled`', () => {
    render(<InstallPrompt />);

    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });
    expect(screen.getByTestId('install-prompt')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(screen.queryByTestId('install-prompt')).not.toBeInTheDocument();
  });
});
