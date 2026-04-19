import { useTranslation } from 'react-i18next';

import { useAuth } from '@/hooks/use-auth';

export const DashboardPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const displayName =
    (user?.user_metadata?.prenom as string | undefined) ??
    user?.email?.split('@')[0] ??
    '';

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {t('dashboard.welcome', { name: displayName })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('dashboard.placeholder')}
        </p>
      </header>
    </section>
  );
};
