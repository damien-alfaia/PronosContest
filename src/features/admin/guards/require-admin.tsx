import { Navigate, Outlet } from 'react-router-dom';

import { FullScreenSpinner } from '@/components/common/full-screen-spinner';
import { useIsAdmin } from '@/features/admin/hooks/use-is-admin';

/**
 * Guard de routes admin.
 *
 * - Tant que la requête `profiles.role` n'est pas résolue → spinner plein écran
 *   (évite un flash de la page admin ou un redirect prématuré).
 * - Pas admin → redirect silencieux vers `/app/dashboard`.
 * - Admin → `<Outlet />`.
 *
 * À monter SOUS `<RequireAuth />` (on suppose que l'utilisateur est
 * déjà authentifié ici : la requête `profiles.role` passe par la RLS
 * de `profiles` qui exige `auth.uid() = id`).
 */
export const RequireAdmin = () => {
  const { isAdmin, isReady } = useIsAdmin();

  if (!isReady) return <FullScreenSpinner />;
  if (!isAdmin) return <Navigate to="/app/dashboard" replace />;

  return <Outlet />;
};
