import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

/**
 * Hook qui retourne vrai si l'utilisateur courant est admin global
 * (`profiles.role = 'admin'`).
 *
 * - `isAdmin` : boolean résolu une fois la requête terminée.
 * - `isReady` : true quand on a une réponse (succès OU erreur). Utile
 *   pour les guards qui ne veulent pas flasher avant d'avoir décidé.
 *
 * Convention de queryKey : `['admin', 'isAdmin', userId]` pour que le
 * switch d'utilisateur (logout / login) reparte proprement.
 *
 * Staletime long (5 min) : le rôle ne change presque jamais en session.
 * Un appel explicite côté admin change déjà le profil en base, on peut
 * rafraîchir à la demande.
 */
export const useIsAdmin = (): {
  isAdmin: boolean;
  isReady: boolean;
  isLoading: boolean;
} => {
  const { user, isReady: authReady } = useAuth();
  const userId = user?.id;

  const query = useQuery<boolean>({
    queryKey: ['admin', 'isAdmin', userId ?? 'anon'] as const,
    queryFn: async () => {
      if (!userId) return false;
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      return data?.role === 'admin';
    },
    enabled: Boolean(userId) && authReady,
    staleTime: 5 * 60_000,
  });

  return {
    isAdmin: query.data === true,
    isReady: authReady && (query.isSuccess || query.isError || !userId),
    isLoading: query.isLoading,
  };
};
