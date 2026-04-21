import {
  Flag,
  LayoutDashboard,
  ListOrdered,
  ShieldCheck,
  Trophy,
  User,
} from 'lucide-react';

export type NavItem = {
  /** Clé i18n à résoudre dans le composant */
  labelKey: string;
  to: string;
  icon: typeof LayoutDashboard;
  /** Afficher dans la bottom-nav mobile ? */
  mobile?: boolean;
  /** Réservé aux utilisateurs admin (filtré côté Sidebar / BottomNav). */
  adminOnly?: boolean;
};

/**
 * Source unique de vérité pour la navigation de l'app.
 *
 * La Sidebar (desktop) affiche tout, sauf les items `adminOnly` pour les
 * non-admins.
 * La BottomNav (mobile) affiche les items marqués `mobile: true` (max 5),
 * idem filtré sur `adminOnly`.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    labelKey: 'nav.dashboard',
    to: '/app/dashboard',
    icon: LayoutDashboard,
    mobile: true,
  },
  {
    labelKey: 'nav.concours',
    to: '/app/concours',
    icon: Trophy,
    mobile: true,
  },
  { labelKey: 'nav.profile', to: '/app/profile', icon: User, mobile: true },
  {
    labelKey: 'nav.adminMatchs',
    to: '/app/admin/matchs',
    icon: ShieldCheck,
    adminOnly: true,
  },
  {
    labelKey: 'nav.adminCompetitions',
    to: '/app/admin/competitions',
    icon: ListOrdered,
    adminOnly: true,
  },
  {
    labelKey: 'nav.adminEquipes',
    to: '/app/admin/equipes',
    icon: Flag,
    adminOnly: true,
  },
] as const;
