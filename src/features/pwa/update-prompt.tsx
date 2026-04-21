import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Hook-composant qui s'enregistre au service worker et **notifie** l'utilisateur
 * quand une nouvelle version de l'app est prête à être chargée.
 *
 * UX :
 *   - `registerType: 'prompt'` dans `vite.config.ts` → le nouveau SW attend.
 *   - Dès que `needRefresh === true`, on déclenche un toast `sonner` avec deux
 *     actions : "Recharger" (applique la nouvelle version) / "Plus tard"
 *     (ferme le toast, on repassera au prochain boot). Jamais de reload en
 *     plein formulaire sans le consentement de l'utilisateur.
 *   - `offlineReady` : on affiche un toast succès (discret) pour confirmer que
 *     l'app est utilisable hors-ligne — utile la 1re fois qu'on installe.
 *
 * Le composant ne rend rien (null) : tous les effets passent par sonner.
 * Monté une seule fois au root du layout (AppLayout).
 */
export const UpdatePrompt = () => {
  const { t } = useTranslation();
  const toastIdRef = useRef<string | number | null>(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      // On ne casse pas l'app si l'enregistrement SW échoue (ex : env dev,
      // navigateur incompatible). On logge uniquement (warn autorisé par
      // l'ESLint config).
      console.warn('[PWA] Service worker registration failed:', error);
    },
  });

  // Toast "nouvelle version" — déclenché quand le nouveau SW est waiting.
  useEffect(() => {
    if (!needRefresh) return;

    const id = toast(t('pwa.update.title'), {
      description: t('pwa.update.description'),
      duration: Infinity,
      action: {
        label: t('pwa.update.reload'),
        onClick: () => {
          // skipWaiting + reload géré par workbox-window côté vite-plugin-pwa.
          void updateServiceWorker(true);
        },
      },
      cancel: {
        label: t('pwa.update.later'),
        onClick: () => {
          setNeedRefresh(false);
        },
      },
    });

    toastIdRef.current = id;

    return () => {
      if (toastIdRef.current !== null) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
    };
  }, [needRefresh, setNeedRefresh, t, updateServiceWorker]);

  // Toast "prêt hors-ligne" — 1re install réussie.
  useEffect(() => {
    if (!offlineReady) return;

    toast.success(t('pwa.offlineReady.title'), {
      description: t('pwa.offlineReady.description'),
      duration: 4000,
    });

    setOfflineReady(false);
  }, [offlineReady, setOfflineReady, t]);

  return null;
};
