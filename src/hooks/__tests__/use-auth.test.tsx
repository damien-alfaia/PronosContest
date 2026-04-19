import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}));

const resetStore = () => {
  useAuthStore.setState({ session: null, user: null, isReady: false });
};

describe('useAuth', () => {
  beforeEach(resetStore);
  afterEach(() => vi.clearAllMocks());

  it('reflète isAuthenticated / isReady depuis le store', () => {
    const { result, rerender } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isReady).toBe(false);

    act(() => {
      useAuthStore.setState({
        session: { user: { id: 'u1' } } as never,
        user: { id: 'u1' } as never,
        isReady: true,
      });
    });
    rerender();
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isReady).toBe(true);
    expect(result.current.user?.id).toBe('u1');
  });

  it('signOut délègue à supabase.auth.signOut', async () => {
    const { result } = renderHook(() => useAuth());
    const { supabase } = await import('@/lib/supabase');
    await act(async () => {
      await result.current.signOut();
    });
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });
});
