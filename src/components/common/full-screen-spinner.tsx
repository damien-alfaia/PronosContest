import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Props = {
  label?: string;
};

export const FullScreenSpinner = ({ label }: Props) => {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center gap-3 text-muted-foreground"
    >
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
};
