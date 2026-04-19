import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { FullScreenSpinner } from '@/components/common/full-screen-spinner';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

/**
 * Page d'atterrissage des redirects Supabase (magic link, OAuth, email confirm,
 * password recovery…).
 *
 * - Si l'URL contient un `error` → redirige vers /auth/login
 * - Si on détecte un `type=recovery` → redirige vers /auth/reset-password
 * - Sinon on attend que la session arrive (onAuthStateChange via AuthProvider)
 *   et on route vers /app/dashboard.
 */
export const CallbackPage = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isReady } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // Les liens Supabase par défaut mettent les params dans le hash (`#access_token=...`).
    // supabase-js les consomme automatiquement au boot via detectSessionInUrl.
    const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
    const searchParams = new URLSearchParams(location.search);

    const errorCode = searchParams.get('error') ?? hashParams.get('error');
    if (errorCode) {
      navigate('/auth/login', { replace: true });
      return;
    }

    // password recovery: Supabase met `type=recovery` dans le hash
    if (hashParams.get('type') === 'recovery') {
      navigate('/auth/reset-password', { replace: true });
      return;
    }

    // Timeout de sécurité : si au bout de 8s on n'a toujours pas de session,
    // on renvoie l'utilisateur sur le login.
    const id = window.setTimeout(() => setTimedOut(true), 8000);
    return () => window.clearTimeout(id);
  }, [location, navigate]);

  useEffect(() => {
    // Empêche le SDK de laisser traîner les tokens dans l'URL après lecture.
    if (location.hash && isReady) {
      void supabase.auth.getSession().then(() => {
        window.history.replaceState({}, '', location.pathname);
      });
    }
  }, [isReady, location.hash, location.pathname]);

  if (isReady && isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />;
  }
  if (timedOut) {
    return <Navigate to="/auth/login" replace />;
  }

  return <FullScreenSpinner label={`${t('auth.callback.title')}…`} />;
};
