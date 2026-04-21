import { useEffect, useState } from 'react';

/**
 * Hook réactif sur l'état réseau (`navigator.onLine`).
 *
 * - Initial value via `navigator.onLine` (si disponible, sinon `true` par
 *   défaut pour ne pas afficher le banner offline avant qu'on sache).
 * - Listeners `online` / `offline` sur `window` avec cleanup au démontage.
 *
 * ⚠️ `navigator.onLine` reflète la présence d'une *interface réseau*, pas
 * la joignabilité réelle du backend — un wifi captif renverra `true` alors
 * que la requête Supabase échoue. On s'en contente pour un indicateur
 * indicatif. Pour un check plus fiable, il faudrait pinger Supabase.
 */
export const useOnlineStatus = (): boolean => {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
};
