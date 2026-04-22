import { Outlet } from 'react-router-dom';

import { BottomNav } from '@/components/layout/bottom-nav';
import { Topbar } from '@/components/layout/topbar';
import { InstallPrompt } from '@/features/pwa/install-prompt';
import { OfflineBanner } from '@/features/pwa/offline-banner';
import { UpdatePrompt } from '@/features/pwa/update-prompt';

/**
 * Shell applicatif (pages sous `/app/*`).
 *
 * Layout :
 *  - OfflineBanner (si hors-ligne) tout en haut
 *  - Topbar collante en haut (logo + nav desktop + actions)
 *  - Zone de contenu (Outlet) centrée
 *  - BottomNav fixe en bas (mobile uniquement)
 *
 * Padding bottom supplémentaire sur mobile pour ne pas être caché par la BottomNav.
 * Pas de sidebar : la Topbar porte la nav desktop, la BottomNav la nav mobile.
 */
export const AppLayout = () => (
  <div className="min-h-screen bg-background text-foreground">
    <OfflineBanner />
    <Topbar />
    <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 md:pb-10">
      <Outlet />
    </main>
    <BottomNav />
    <InstallPrompt />
    <UpdatePrompt />
  </div>
);
