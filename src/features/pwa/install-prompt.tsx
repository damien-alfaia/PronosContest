import { Download, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Event Chromium/Edge/Android non-standard déclenché quand le navigateur
 * estime que l'app est éligible à l'installation PWA.
 * Types maison — le DOM lib ne les expose pas.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

/** Clé de dismiss persistée : évite de re-spam l'utilisateur qui a dit non. */
const DISMISS_KEY = 'pwa:install:dismissedAt';
/** Délai avant de reproposer après un dismiss explicite : 30 jours. */
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Lit la date de dismiss (timestamp ms) en `localStorage` et renvoie `true`
 * si on est encore dans la fenêtre de silence. Résilient au SSR.
 */
const isRecentlyDismissed = (): boolean => {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const ts = Number.parseInt(raw, 10);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < DISMISS_TTL_MS;
};

const markDismissed = () => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
};

/**
 * Détecte si l'app tourne déjà en mode "installée" (standalone ou iOS home).
 * Si oui, on n'affiche JAMAIS le banner — l'app est déjà installée.
 */
const isStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  const mql = window.matchMedia?.('(display-mode: standalone)');
  if (mql?.matches) return true;
  // iOS Safari : flag non-standard `navigator.standalone`.
  const navStandalone = (
    window.navigator as Navigator & { standalone?: boolean }
  ).standalone;
  return navStandalone === true;
};

/**
 * Banner "Installer l'app" — apparaît en bas d'écran quand le navigateur
 * déclenche `beforeinstallprompt` (Chrome / Edge / Android).
 *
 * Flow :
 *   1. On écoute `beforeinstallprompt`, on `preventDefault()` pour empêcher
 *      Chrome d'afficher sa propre mini-barre, et on stocke l'event (le spec
 *      impose qu'on ne peut déclencher `prompt()` qu'une fois).
 *   2. Si l'utilisateur clique "Installer", on appelle `promptEvent.prompt()`
 *      puis on lit `userChoice`. Quel que soit le choix, on oublie l'event
 *      (réutilisation interdite par le navigateur) et on cache le banner.
 *   3. Si l'utilisateur clique "X", on marque `dismissed` en `localStorage`
 *      pour 30 jours — on ne le harcèle pas.
 *   4. On écoute aussi `appinstalled` pour cacher le banner si l'install se
 *      fait par un autre chemin (menu Chrome, Play Store, etc.).
 *   5. iOS Safari ne déclenche pas `beforeinstallprompt` — pas de banner
 *      automatique sur iPhone/iPad. Un futur lot pourra ajouter une
 *      indication manuelle "Ajouter à l'écran d'accueil".
 *
 * Rend `null` par défaut → zéro impact DOM tant que l'event n'est pas reçu.
 */
export const InstallPrompt = () => {
  const { t } = useTranslation();
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isHidden, setIsHidden] = useState<boolean>(
    () => isStandalone() || isRecentlyDismissed(),
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setPromptEvent(null);
      setIsHidden(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } finally {
      // L'event ne peut être réutilisé après prompt() — on le jette.
      setPromptEvent(null);
    }
  }, [promptEvent]);

  const handleDismiss = useCallback(() => {
    markDismissed();
    setIsHidden(true);
  }, []);

  if (isHidden || !promptEvent) return null;

  return (
    <div
      role="region"
      aria-label={t('pwa.install.bannerAriaLabel')}
      data-testid="install-prompt"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40',
        'md:inset-x-auto md:right-6 md:bottom-6 md:max-w-sm',
        'mx-auto w-full max-w-xl',
        'border border-border bg-card text-card-foreground',
        'shadow-lg md:rounded-lg',
        'p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:pb-4',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Download className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t('pwa.install.title')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('pwa.install.description')}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleInstall}
              data-testid="install-prompt-install"
            >
              {t('pwa.install.cta')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
            >
              {t('pwa.install.later')}
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t('pwa.install.close')}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
