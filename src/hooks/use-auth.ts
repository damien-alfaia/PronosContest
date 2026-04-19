import { useCallback } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Hook d'accès à l'état d'auth + helpers usuels.
 *
 * Le provider `<AuthProvider>` s'occupe d'initialiser le store et
 * de s'abonner à `onAuthStateChange`. Ce hook n'en consomme que l'état.
 */
export const useAuth = () => {
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const isReady = useAuthStore((s) => s.isReady);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    session,
    user,
    isAuthenticated: !!session,
    isReady,
    signOut,
  } as const;
};
