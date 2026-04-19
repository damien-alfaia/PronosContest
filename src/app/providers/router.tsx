import { createBrowserRouter } from 'react-router-dom';

import { AppLayout } from '@/components/layout/app-layout';
import { RedirectIfAuth } from '@/features/auth/guards/redirect-if-auth';
import { RequireAuth } from '@/features/auth/guards/require-auth';
import { CallbackPage } from '@/features/auth/pages/callback-page';
import { ForgotPasswordPage } from '@/features/auth/pages/forgot-password-page';
import { LoginPage } from '@/features/auth/pages/login-page';
import { ResetPasswordPage } from '@/features/auth/pages/reset-password-page';
import { SignupPage } from '@/features/auth/pages/signup-page';
import { ClassementPage } from '@/features/classement/classement-page';
import { ConcoursPage } from '@/features/concours/concours-page';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { LandingPage } from '@/features/landing/landing-page';
import { ProfilePage } from '@/features/profile/profile-page';
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
          { path: '/app/pronos', element: <PronosPage /> },
          { path: '/app/classement', element: <ClassementPage /> },
          { path: '/app/profile', element: <ProfilePage /> },
        ],
      },
    ],
  },

  // Fallback
  { path: '*', element: <LandingPage /> },
]);
