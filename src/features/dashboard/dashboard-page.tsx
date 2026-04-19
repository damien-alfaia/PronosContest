import { useTranslation } from 'react-i18next';

import { ThemeToggle } from '@/components/common/theme-toggle';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

export const DashboardPage = () => {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();

  const displayName =
    (user?.user_metadata?.prenom as string | undefined) ??
    user?.email?.split('@')[0] ??
    '';

  const toggleLocale = () => {
    void i18n.changeLanguage(i18n.language.startsWith('fr') ? 'en' : 'fr');
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={toggleLocale}>
          {i18n.language.toUpperCase().slice(0, 2)}
        </Button>
        <ThemeToggle />
      </div>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        {t('dashboard.welcome', { name: displayName })}
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {t('dashboard.placeholder')}
      </p>
      <Button variant="outline" onClick={() => void signOut()}>
        {t('nav.logout')}
      </Button>
    </main>
  );
};
