import { Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { LanguageSwitcher } from '@/components/common/language-switcher';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';

/**
 * Barre supérieure fixe :
 * - desktop : actions à droite (thème, langue, utilisateur)
 * - mobile  : logo + app name (la nav est dans <BottomNav />)
 */
export const Topbar = () => {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-20 flex h-topbar items-center justify-between border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Link
        to="/app/dashboard"
        className="flex items-center gap-2 md:invisible md:pointer-events-none"
        aria-label={t('app.title')}
      >
        <Trophy className="h-5 w-5 text-primary" aria-hidden />
        <span className="text-sm font-semibold tracking-tight">
          {t('app.title')}
        </span>
      </Link>
      <div className="flex items-center gap-1">
        <LanguageSwitcher />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
};
