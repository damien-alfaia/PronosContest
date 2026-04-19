import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type PagePlaceholderProps = {
  titleKey: string;
  descriptionKey: string;
  icon?: ReactNode;
};

/**
 * Placeholder réutilisable pour les pages pas encore implémentées.
 * On garde un H1 sémantique pour l'accessibilité et la future SEO.
 */
export const PagePlaceholder = ({ titleKey, descriptionKey, icon }: PagePlaceholderProps) => {
  const { t } = useTranslation();

  return (
    <section className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/20 p-10 text-center">
      {icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
      ) : null}
      <h1 className="text-2xl font-semibold tracking-tight">{t(titleKey)}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t(descriptionKey)}</p>
      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium uppercase tracking-wide text-secondary-foreground">
        {t('common.comingSoon')}
      </span>
    </section>
  );
};
