import { LayoutDashboard, Trophy, Target, BarChart3, User } from 'lucide-react';

export type NavItem = {
  /** Clé i18n à résoudre dans le composant */
  labelKey: string;
  to: string;
  icon: typeof LayoutDashboard;
  /** Afficher dans la bottom-nav mobile ? */
  mobile?: boolean;
};

/**
 * Source unique de vérité pour la navigation de l'app.
 *
 * La Sidebar (desktop) affiche tout.
 * La BottomNav (mobile) affiche les items marqués `mobile: true` (max 5).
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { labelKey: 'nav.dashboard', to: '/app/dashboard', icon: LayoutDashboard, mobile: true },
  { labelKey: 'nav.concours', to: '/app/concours', icon: Trophy, mobile: true },
  { labelKey: 'nav.pronos', to: '/app/pronos', icon: Target, mobile: true },
  { labelKey: 'nav.classement', to: '/app/classement', icon: BarChart3, mobile: true },
  { labelKey: 'nav.profile', to: '/app/profile', icon: User, mobile: true },
] as const;
