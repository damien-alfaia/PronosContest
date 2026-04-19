import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

export function LandingPage() {
  const { t, i18n } = useTranslation();

  const toggleLocale = () => {
    void i18n.changeLanguage(i18n.language === 'fr' ? 'en' : 'fr');
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-orange-500 text-2xl font-black text-white shadow-lg">
          P
        </span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {t('app.title')}
        </h1>
        <p className="max-w-md text-sm text-muted-foreground sm:text-base">
          {t('app.tagline')}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button>{t('app.cta')}</Button>
        <Button variant="outline" onClick={toggleLocale}>
          {i18n.language.toUpperCase()}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Sprint 0 — {t('app.sprintStatus')}
      </p>
    </main>
  );
}
