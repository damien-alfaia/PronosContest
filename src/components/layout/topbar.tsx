import { Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';

import { LanguageSwitcher } from '@/components/common/language-switcher';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { NAV_ITEMS } from '@/components/layout/nav-items';
import { UserMenu } from '@/components/layout/user-menu';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { cn } from '@/lib/utils';

/**
 * Barre supérieure fixe — rôle double :
 *
 * - **Mobile (< md)** : logo + app name à gauche, actions (langue, thème,
 *   menu user) à droite. La navigation principale est dans la BottomNav.
 *
 * - **Desktop (≥ md)** : logo + nav horizontale (items NAV_ITEMS filtrés
 *   sur `mobile: true` — ce sont les destinations primaires utilisateur,
 *   l'admin vit dans le UserMenu), puis actions à droite.
 *
 * La sidebar a été retirée : une seule barre principale, nav
 * contextuelle selon l'écran.
 */
export const Topbar = () => {
  const { t } = useTranslation();

  // On réutilise le flag `mobile` de NAV_ITEMS pour définir ce qui est
  // "destination primaire utilisateur". L'admin (non mobile) passe par
  // le UserMenu, plus discret pour les non-concernés.
  const primaryItems = NAV_ITEMS.filter((i) => i.mobile);

  return (
    <header className="sticky top-0 z-20 flex h-topbar items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Gauche : logo + nav desktop */}
      <div className="flex min-w-0 items-center gap-6">
        <Link
          to="/app/dashboard"
          className="flex shrink-0 items-center gap-2"
          aria-label={t('app.title')}
        >
          <Trophy className="h-5 w-5 text-primary" aria-hidden />
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">
            {t('app.title')}
          </span>
        </Link>

        <nav
          aria-label={t('nav.primary')}
          className="hidden md:flex md:items-center md:gap-1"
        >
          {primaryItems.map(({ labelKey, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  'hover:bg-accent/50 hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-accent/60 text-foreground'
                    : 'text-muted-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" aria-hidden />
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Droite : actions */}
      <div className="flex shrink-0 items-center gap-1">
        <NotificationBell />
        <LanguageSwitcher />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
};
