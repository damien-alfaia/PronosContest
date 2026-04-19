import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { FullScreenSpinner } from '@/components/common/full-screen-spinner';
import { useAuth } from '@/hooks/use-auth';

/**
 * Guard de routes privées.
 *
 * - Tant que `isReady=false` → spinner plein écran (évite un flash vers /auth/login)
 * - Pas d'authenticated → redirige vers /auth/login en mémorisant `from`
 * - Authenticated → `<Outlet />`
 */
export const RequireAuth = () => {
  const { isAuthenticated, isReady } = useAuth();
  const location = useLocation();

  if (!isReady) return <FullScreenSpinner />;
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
};
