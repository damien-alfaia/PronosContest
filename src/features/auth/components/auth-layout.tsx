import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { ThemeToggle } from '@/components/common/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export const AuthLayout = ({ title, subtitle, children, footer }: Props) => {
  const { t, i18n } = useTranslation();
  const toggleLocale = () => {
    void i18n.changeLanguage(i18n.language.startsWith('fr') ? 'en' : 'fr');
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted px-4 py-12">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLocale}
          aria-label={t('locale.toggle')}
        >
          {i18n.language.toUpperCase().slice(0, 2)}
        </Button>
        <ThemeToggle />
      </div>
      <Link
        to="/"
        className="absolute left-4 top-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-orange-500 text-sm font-black text-white">
          P
        </span>
        PronosticsContest
      </Link>

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <CardTitle>{title}</CardTitle>
          {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
        {footer ? (
          <div className="border-t p-6 pt-4 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </Card>
    </main>
  );
};
