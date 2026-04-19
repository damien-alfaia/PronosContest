import { useEffect, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

type Props = {
  children: ReactNode;
};

/**
 * Initialise le store d'auth et s'abonne à `onAuthStateChange`.
 *
 * Flow :
 * 1. boot : `supabase.auth.getSession()` → setSession + setReady(true)
 * 2. listener : SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED / USER_UPDATED → setSession
 */
export const AuthProvider = ({ children }: Props) => {
  const setSession = useAuthStore((s) => s.setSession);
  const setReady = useAuthStore((s) => s.setReady);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setReady(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      },
    );

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [setSession, setReady]);

  return <>{children}</>;
};
