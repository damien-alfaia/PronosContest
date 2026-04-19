import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Locale = 'fr' | 'en';

const SUPPORTED: ReadonlyArray<{ value: Locale; labelKey: string }> = [
  { value: 'fr', labelKey: 'locale.fr' },
  { value: 'en', labelKey: 'locale.en' },
];

/**
 * Switch de langue à base de DropdownMenu.
 *
 * On se contente de déléguer à `i18n.changeLanguage()` ;
 * `i18next-browser-languagedetector` persiste le choix en localStorage.
 */
export const LanguageSwitcher = () => {
  const { t, i18n } = useTranslation();

  const current = (i18n.language.split('-')[0] ?? 'fr') as Locale;

  const setLocale = (value: Locale) => {
    if (value === current) return;
    void i18n.changeLanguage(value);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('locale.toggle')}
        >
          <Languages className="h-5 w-5" aria-hidden />
          <span className="sr-only">{t('locale.toggle')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('locale.label')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED.map(({ value, labelKey }) => (
          <DropdownMenuItem
            key={value}
            onSelect={() => setLocale(value)}
            className={current === value ? 'font-semibold' : ''}
          >
            <span className="mr-2 inline-flex h-5 w-8 items-center justify-center rounded border text-xs uppercase">
              {value}
            </span>
            {t(labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
