import { Outlet } from 'react-router-dom';

import { BottomNav } from '@/components/layout/bottom-nav';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { InstallPrompt } from '@/features/pwa/install-prompt';
import { OfflineBanner } from '@/features/pwa/offline-banner';
import { UpdatePrompt } from '@/features/pwa/update-prompt';

/**
 * Shell applicatif (pages sous `/app/*`).
 *
 * Layout :
 *  - OfflineBanner (si hors-ligne) tout en haut
 *  - Sidebar fixe à gauche (md+)
 *  - Topbar collante en haut
 *  - Zone de contenu (Outlet)
 *  - BottomNav fixe en bas (mobile uniquement)
 *
 * Padding bottom supplémentaire sur mobile pour ne pas être caché par la BottomNav.
 */
export const AppLayout = () => (
  <div className="min-h-screen bg-background text-foreground">
    <OfflineBanner />
    <Sidebar />
    <div className="md:pl-56">
      <Topbar />
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 md:pb-10">
        <Outlet />
      </main>
    </div>
    <BottomNav />
    <InstallPrompt />
    <UpdatePrompt />
  </div>
);
