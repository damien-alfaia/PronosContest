import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useOnlineStatus } from '@/hooks/use-online-status';
import { cn } from '@/lib/utils';

/**
 * Bannière affichée en haut de l'app quand `navigator.onLine === false`.
 *
 * UX :
 *   - Bloc en flux normal tout en haut de l'app (avant Topbar).
 *     Quand elle apparaît, elle pousse le contenu vers le bas — la Topbar
 *     sticky reste juste en-dessous. Pas de `fixed` pour ne pas masquer
 *     la Topbar.
 *   - Fond ambre (warning, pas destructive) — on peut toujours naviguer
 *     dans le cache, on n'est pas "en erreur".
 *   - Icône WifiOff + message localisé + hint "certaines fonctionnalités
 *     peuvent être limitées" (les pronos en live, le chat, les notifs
 *     realtime dépendent du réseau).
 *   - `role="status" aria-live="polite"` pour que les lecteurs d'écran
 *     annoncent le changement sans interrompre.
 *
 * Rend `null` quand on est online → pas d'impact DOM.
 */
export const OfflineBanner = () => {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
      className={cn(
        'relative z-30',
        'flex items-center justify-center gap-2 px-4 py-2',
        'bg-amber-500 text-amber-950 shadow-sm',
        'dark:bg-amber-600 dark:text-amber-50',
        'text-sm font-medium',
      )}
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{t('pwa.offline.banner')}</span>
      <span className="hidden sm:inline text-amber-900/80 dark:text-amber-100/80">
        · {t('pwa.offline.hint')}
      </span>
    </div>
  );
};
