import { createBrowserRouter } from 'react-router-dom';

import { AppLayout } from '@/components/layout/app-layout';
import { RequireAdmin } from '@/features/admin/guards/require-admin';
import { RedirectIfAuth } from '@/features/auth/guards/redirect-if-auth';
import { RequireAuth } from '@/features/auth/guards/require-auth';
import { LandingPage } from '@/features/landing/landing-page';

/**
 * Routing applicatif — route-level code splitting.
 *
 * Stratégie (Sprint 7.B.1) :
 *   - **Eager** : Landing (le SEO / first-paint de la homepage doit être
 *     immédiat), les deux guards d'auth (ils doivent décider avant l'écran),
 *     et le shell `AppLayout` (vide, minimal).
 *   - **Lazy** (`lazy: async () => ({ Component })`) : toutes les pages
 *     `/auth/*` et `/app/*`. Chaque page devient un chunk isolé ; React
 *     Router v6.4+ gère le loading sans Suspense explicite (il affiche
 *     l'élément parent en attendant). Les `navigation.state === 'loading'`
 *     peuvent être observés via `useNavigation()` si on veut un loader
 *     global, mais le shell vide est acceptable au MVP.
 *
 * Gain attendu :
 *   - `landing` ne charge plus dashboard, concours, admin, etc. → bundle
 *     initial allégé de ~300–500 KB (auth + features métier).
 *   - La première navigation vers `/app/*` télécharge juste la page demandée.
 */
export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },

  // Pages accessibles UNIQUEMENT si non-loggué
  {
    element: <RedirectIfAuth />,
    children: [
      {
        path: '/auth/login',
        lazy: async () => {
          const { LoginPage } = await import(
            '@/features/auth/pages/login-page'
          );
          return { Component: LoginPage };
        },
      },
      {
        path: '/auth/signup',
        lazy: async () => {
          const { SignupPage } = await import(
            '@/features/auth/pages/signup-page'
          );
          return { Component: SignupPage };
        },
      },
      {
        path: '/auth/forgot-password',
        lazy: async () => {
          const { ForgotPasswordPage } = await import(
            '@/features/auth/pages/forgot-password-page'
          );
          return { Component: ForgotPasswordPage };
        },
      },
    ],
  },

  // Pages qui doivent marcher dans les deux états (liens email entrants)
  {
    path: '/auth/callback',
    lazy: async () => {
      const { CallbackPage } = await import(
        '@/features/auth/pages/callback-page'
      );
      return { Component: CallbackPage };
    },
  },
  {
    path: '/auth/reset-password',
    lazy: async () => {
      const { ResetPasswordPage } = await import(
        '@/features/auth/pages/reset-password-page'
      );
      return { Component: ResetPasswordPage };
    },
  },

  // Pages privées (dans le shell AppLayout)
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: '/app/dashboard',
            lazy: async () => {
              const { DashboardPage } = await import(
                '@/features/dashboard/dashboard-page'
              );
              return { Component: DashboardPage };
            },
          },
          {
            path: '/app/concours',
            lazy: async () => {
              const { ConcoursPage } = await import(
                '@/features/concours/concours-page'
              );
              return { Component: ConcoursPage };
            },
          },
          {
            path: '/app/concours/nouveau',
            lazy: async () => {
              const { ConcoursNewPage } = await import(
                '@/features/concours/concours-new-page'
              );
              return { Component: ConcoursNewPage };
            },
          },
          {
            path: '/app/concours/:id',
            lazy: async () => {
              const { ConcoursDetailPage } = await import(
                '@/features/concours/concours-detail-page'
              );
              return { Component: ConcoursDetailPage };
            },
          },
          {
            path: '/app/concours/:id/pronos',
            lazy: async () => {
              const { PronosGridPage } = await import(
                '@/features/pronos/pronos-grid-page'
              );
              return { Component: PronosGridPage };
            },
          },
          {
            path: '/app/concours/:id/classement',
            lazy: async () => {
              const { ConcoursClassementPage } = await import(
                '@/features/classement/concours-classement-page'
              );
              return { Component: ConcoursClassementPage };
            },
          },
          {
            path: '/app/pronos',
            lazy: async () => {
              const { PronosPage } = await import(
                '@/features/pronos/pronos-page'
              );
              return { Component: PronosPage };
            },
          },
          {
            path: '/app/classement',
            lazy: async () => {
              const { ClassementPage } = await import(
                '@/features/classement/classement-page'
              );
              return { Component: ClassementPage };
            },
          },
          {
            path: '/app/profile',
            lazy: async () => {
              const { ProfilePage } = await import(
                '@/features/profile/profile-page'
              );
              return { Component: ProfilePage };
            },
          },

          // Routes admin (filtrées par RequireAdmin)
          {
            element: <RequireAdmin />,
            children: [
              {
                path: '/app/admin/matchs',
                lazy: async () => {
                  const { AdminMatchsPage } = await import(
                    '@/features/admin/matchs/admin-matchs-page'
                  );
                  return { Component: AdminMatchsPage };
                },
              },
              {
                path: '/app/admin/competitions',
                lazy: async () => {
                  const { AdminCompetitionsPage } = await import(
                    '@/features/admin/competitions/admin-competitions-page'
                  );
                  return { Component: AdminCompetitionsPage };
                },
              },
              {
                path: '/app/admin/equipes',
                lazy: async () => {
                  const { AdminEquipesPage } = await import(
                    '@/features/admin/equipes/admin-equipes-page'
                  );
                  return { Component: AdminEquipesPage };
                },
              },
            ],
          },
        ],
      },
    ],
  },

  // Fallback
  { path: '*', element: <LandingPage /> },
]);
