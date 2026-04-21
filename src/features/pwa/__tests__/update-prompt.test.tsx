import { render } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '@/i18n';

// ─── Mocks hoistés ───────────────────────────────────────────────────────
// `vi.hoisted` est exécuté avant tout `import` → parfait pour exposer des spies
// partagés entre le mock et le test. Ne PAS référencer de const du module ici
// (hoisting TDZ).
const mocks = vi.hoisted(() => {
  const needRefreshSetter = vi.fn();
  const offlineReadySetter = vi.fn();
  const updateServiceWorker = vi.fn().mockResolvedValue(undefined);

  const state = {
    needRefresh: false,
    offlineReady: false,
  };

  const useRegisterSW = () => ({
    needRefresh: [state.needRefresh, needRefreshSetter],
    offlineReady: [state.offlineReady, offlineReadySetter],
    updateServiceWorker,
  });

  const toastFn = vi.fn(() => 'toast-id') as unknown as (
    ...args: unknown[]
  ) => string | number;
  const toastSuccess = vi.fn();
  const toastDismiss = vi.fn();
  const toast = Object.assign(toastFn, {
    success: toastSuccess,
    dismiss: toastDismiss,
  });

  return {
    state,
    setNeedRefresh: (v: boolean) => {
      state.needRefresh = v;
    },
    setOfflineReady: (v: boolean) => {
      state.offlineReady = v;
    },
    needRefreshSetter,
    offlineReadySetter,
    updateServiceWorker,
    useRegisterSW,
    toast,
    toastSuccess,
    toastDismiss,
  };
});

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: mocks.useRegisterSW,
}));

vi.mock('sonner', () => ({
  toast: mocks.toast,
}));

// Import APRÈS vi.mock pour que la résolution prenne bien le mock.
import { UpdatePrompt } from '@/features/pwa/update-prompt';

describe('<UpdatePrompt />', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('fr');
  });

  beforeEach(() => {
    mocks.state.needRefresh = false;
    mocks.state.offlineReady = false;
    mocks.needRefreshSetter.mockClear();
    mocks.offlineReadySetter.mockClear();
    mocks.updateServiceWorker.mockClear();
    (mocks.toast as unknown as ReturnType<typeof vi.fn>).mockClear();
    mocks.toastSuccess.mockClear();
    mocks.toastDismiss.mockClear();
  });

  it('ne déclenche aucun toast quand needRefresh=false et offlineReady=false', () => {
    const { container } = render(<UpdatePrompt />);
    expect(container.firstChild).toBeNull();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it('déclenche un toast "nouvelle version" quand needRefresh=true', () => {
    mocks.state.needRefresh = true;
    render(<UpdatePrompt />);

    expect(mocks.toast).toHaveBeenCalledTimes(1);
    const [title, opts] = (mocks.toast as unknown as ReturnType<typeof vi.fn>)
      .mock.calls[0] as [string, Record<string, unknown>];
    expect(title).toContain('Nouvelle version');
    expect(opts).toMatchObject({
      duration: Infinity,
      action: expect.objectContaining({ label: 'Recharger' }),
      cancel: expect.objectContaining({ label: 'Plus tard' }),
    });
  });

  it('updateServiceWorker(true) appelé quand on clique sur l\'action "Recharger"', () => {
    mocks.state.needRefresh = true;
    render(<UpdatePrompt />);

    const opts = (mocks.toast as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[1] as { action: { onClick: () => void } };
    opts.action.onClick();

    expect(mocks.updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('setNeedRefresh(false) appelé quand on clique sur l\'action "Plus tard"', () => {
    mocks.state.needRefresh = true;
    render(<UpdatePrompt />);

    const opts = (mocks.toast as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[1] as { cancel: { onClick: () => void } };
    opts.cancel.onClick();

    expect(mocks.needRefreshSetter).toHaveBeenCalledWith(false);
  });

  it('déclenche un toast success quand offlineReady=true', () => {
    mocks.state.offlineReady = true;
    render(<UpdatePrompt />);

    expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
    const [title] = mocks.toastSuccess.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(title).toContain('hors ligne');
    expect(mocks.offlineReadySetter).toHaveBeenCalledWith(false);
  });
});
