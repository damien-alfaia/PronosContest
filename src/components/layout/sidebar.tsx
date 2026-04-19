import { Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

import { NAV_ITEMS } from '@/components/layout/nav-items';
import { cn } from '@/lib/utils';

/**
 * Sidebar verticale affichée sur md+ (≥ 768px).
 * Affiche tous les NAV_ITEMS sans filtrage mobile.
 */
export const Sidebar = () => {
  const { t } = useTranslation();

  return (
    <aside className="hidden border-r bg-background md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex md:w-56 md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Trophy className="h-5 w-5 text-primary" aria-hidden />
        <span className="text-sm font-semibold tracking-tight">
          {t('app.title')}
        </span>
      </div>
      <nav
        aria-label={t('nav.primary')}
        className="flex-1 space-y-1 overflow-y-auto p-3"
      >
        {NAV_ITEMS.map(({ labelKey, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground',
              )
            }
          >
            <Icon className="h-4 w-4" aria-hidden />
            {t(labelKey)}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
