import { createBrowserRouter } from 'react-router-dom';

import { AppLayout } from '@/components/layout/app-layout';
import { AdminCompetitionsPage } from '@/features/admin/competitions/admin-competitions-page';
import { AdminEquipesPage } from '@/features/admin/equipes/admin-equipes-page';
import { RequireAdmin } from '@/features/admin/guards/require-admin';
import { AdminMatchsPage } from '@/features/admin/matchs/admin-matchs-page';
import { RedirectIfAuth } from '@/features/auth/guards/redirect-if-auth';
import { RequireAuth } from '@/features/auth/guards/require-auth';
import { CallbackPage } from '@/features/auth/pages/callback-page';
import { ForgotPasswordPage } from '@/features/auth/pages/forgot-password-page';
import { LoginPage } from '@/features/auth/pages/login-page';
import { ResetPasswordPage } from '@/features/auth/pages/reset-password-page';
import { SignupPage } from '@/features/auth/pages/signup-page';
import { ClassementPage } from '@/features/classement/classement-page';
import { ConcoursClassementPage } from '@/features/classement/concours-classement-page';
import { ConcoursDetailPage } from '@/features/concours/concours-detail-page';
import { ConcoursNewPage } from '@/features/concours/concours-new-page';
import { ConcoursPage } from '@/features/concours/concours-page';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { LandingPage } from '@/features/landing/landing-page';
import { ProfilePage } from '@/features/profile/profile-page';
import { PronosGridPage } from '@/features/pronos/pronos-grid-page';
import { PronosPage } from '@/features/pronos/pronos-page';

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },

  // Pages accessibles UNIQUEMENT si non-loggué
  {
    element: <RedirectIfAuth />,
    children: [
      { path: '/auth/login', element: <LoginPage /> },
      { path: '/auth/signup', element: <SignupPage /> },
      { path: '/auth/forgot-password', element: <ForgotPasswordPage /> },
    ],
  },

  // Pages qui doivent marcher dans les deux états (liens email entrants)
  { path: '/auth/callback', element: <CallbackPage /> },
  { path: '/auth/reset-password', element: <ResetPasswordPage /> },

  // Pages privées (dans le shell AppLayout)
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/app/dashboard', element: <DashboardPage /> },
          { path: '/app/concours', element: <ConcoursPage /> },
          { path: '/app/concours/nouveau', element: <ConcoursNewPage /> },
          { path: '/app/concours/:id', element: <ConcoursDetailPage /> },
          { path: '/app/concours/:id/pronos', element: <PronosGridPage /> },
          {
            path: '/app/concours/:id/classement',
            element: <ConcoursClassementPage />,
          },
          { path: '/app/pronos', element: <PronosPage /> },
          { path: '/app/classement', element: <ClassementPage /> },
          { path: '/app/profile', element: <ProfilePage /> },

          // Routes admin (filtrées par RequireAdmin)
          {
            element: <RequireAdmin />,
            children: [
              { path: '/app/admin/matchs', element: <AdminMatchsPage /> },
              {
                path: '/app/admin/competitions',
                element: <AdminCompetitionsPage />,
              },
              { path: '/app/admin/equipes', element: <AdminEquipesPage /> },
            ],
          },
        ],
      },
    ],
  },

  // Fallback
  { path: '*', element: <LandingPage /> },
]);
