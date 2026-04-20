import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

import { NAV_ITEMS } from '@/components/layout/nav-items';
import { useIsAdmin } from '@/features/admin/hooks/use-is-admin';
import { cn } from '@/lib/utils';

/**
 * Navigation fixe en bas d'écran sur mobile (< 768px).
 * Affiche les items marqués `mobile: true` dans NAV_ITEMS.
 * L'entrée admin est `adminOnly` (donc non `mobile`) → absente ici ;
 * sur mobile l'admin passe par la Sidebar ouvrable, ou le menu user.
 */
export const BottomNav = () => {
  const { t } = useTranslation();
  const { isAdmin } = useIsAdmin();
  const items = NAV_ITEMS.filter(
    (i) => i.mobile && (!i.adminOnly || isAdmin),
  );

  return (
    <nav
      aria-label={t('nav.primary')}
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
    >
      <ul
        className="flex items-stretch justify-around"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {items.map(({ labelKey, to, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-0.5 px-2 py-2 text-[11px] font-medium',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span className="truncate">{t(labelKey)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};
