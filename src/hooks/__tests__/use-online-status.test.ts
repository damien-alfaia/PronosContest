import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useOnlineStatus } from '@/hooks/use-online-status';

/**
 * On ne peut pas réassigner `navigator.onLine` (getter en lecture seule dans
 * jsdom), mais on peut le stubber via `Object.defineProperty`. On remet la
 * valeur d'origine après chaque test pour isoler.
 */
const setNavigatorOnline = (value: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
};

describe('useOnlineStatus', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    window.navigator,
    'onLine',
  );

  beforeEach(() => {
    setNavigatorOnline(true);
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(window.navigator, 'onLine', originalDescriptor);
    }
    vi.restoreAllMocks();
  });

  it('retourne true par défaut quand navigator.onLine est true', () => {
    setNavigatorOnline(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it('retourne false quand navigator.onLine est false au montage', () => {
    setNavigatorOnline(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it('réagit à l\'événement offline', () => {
    setNavigatorOnline(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current).toBe(false);
  });

  it('réagit à l\'événement online', () => {
    setNavigatorOnline(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);

    act(() => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current).toBe(true);
  });

  it('nettoie les listeners au démontage', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useOnlineStatus());

    unmount();

    const eventTypes = removeSpy.mock.calls.map(([type]) => type);
    expect(eventTypes).toContain('online');
    expect(eventTypes).toContain('offline');
  });
});
