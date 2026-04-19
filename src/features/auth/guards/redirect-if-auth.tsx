import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { FullScreenSpinner } from '@/components/common/full-screen-spinner';
import { useAuth } from '@/hooks/use-auth';

type LocationState = {
  from?: { pathname?: string };
};

/**
 * Inverse de `RequireAuth` : utilisé sur /auth/login, /auth/signup, /auth/forgot-password.
 *
 * Si l'utilisateur est déjà connecté, on renvoie là d'où il vient (state `from`)
 * ou vers /app/dashboard par défaut.
 */
export const RedirectIfAuth = () => {
  const { isAuthenticated, isReady } = useAuth();
  const location = useLocation();
  const state = location.state as LocationState | null;

  if (!isReady) return <FullScreenSpinner />;
  if (isAuthenticated) {
    const to = state?.from?.pathname ?? '/app/dashboard';
    return <Navigate to={to} replace />;
  }
  return <Outlet />;
};
