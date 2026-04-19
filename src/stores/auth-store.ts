import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

type AuthState = {
  session: Session | null;
  user: User | null;
  /** `false` tant que `supabase.auth.getSession()` n'a pas répondu au boot */
  isReady: boolean;
  setSession: (session: Session | null) => void;
  setReady: (ready: boolean) => void;
  reset: () => void;
};

/**
 * Store d'auth côté client.
 *
 * ⚠️ Le serveur-state (profile Postgres, etc.) passe par TanStack Query,
 * pas ici. Ce store ne contient QUE ce qui tient dans la session JWT.
 */
export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isReady: false,
  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
    }),
  setReady: (ready) => set({ isReady: ready }),
  reset: () => set({ session: null, user: null }),
}));
