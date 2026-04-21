import { render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { i18n } from '@/i18n';

import { OfflineBanner } from '@/features/pwa/offline-banner';

const setNavigatorOnline = (value: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
};

describe('<OfflineBanner />', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    window.navigator,
    'onLine',
  );

  beforeAll(async () => {
    await i18n.changeLanguage('fr');
  });

  beforeEach(() => {
    setNavigatorOnline(true);
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(window.navigator, 'onLine', originalDescriptor);
    }
  });

  it('ne rend rien quand online', () => {
    setNavigatorOnline(true);
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('affiche la bannière quand offline', () => {
    setNavigatorOnline(false);
    render(<OfflineBanner />);

    const banner = screen.getByTestId('offline-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute('role', 'status');
    expect(banner).toHaveAttribute('aria-live', 'polite');
  });

  it('affiche le message FR', () => {
    setNavigatorOnline(false);
    render(<OfflineBanner />);

    expect(screen.getByText('Vous êtes hors ligne')).toBeInTheDocument();
    expect(
      screen.getByText(/Certaines fonctionnalités peuvent être limitées/i),
    ).toBeInTheDocument();
  });
});
