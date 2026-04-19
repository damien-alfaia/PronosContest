import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { MagicLinkForm } from '@/features/auth/components/magic-link-form';
import { PasswordLoginForm } from '@/features/auth/components/password-login-form';

type Mode = 'password' | 'magic-link';

export const LoginPage = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('password');

  return (
    <AuthLayout
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <p>
          {t('auth.login.noAccount')}{' '}
          <Link
            to="/auth/signup"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t('auth.login.signupLink')}
          </Link>
        </p>
      }
    >
      {mode === 'password' ? <PasswordLoginForm /> : <MagicLinkForm />}

      <div className="flex flex-col gap-2 pt-2 text-center text-sm">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setMode(mode === 'password' ? 'magic-link' : 'password')}
        >
          {mode === 'password'
            ? t('auth.login.magicLinkMode')
            : t('auth.login.passwordMode')}
        </Button>
        {mode === 'password' ? (
          <Link
            to="/auth/forgot-password"
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            {t('auth.login.forgotPassword')}
          </Link>
        ) : null}
      </div>
    </AuthLayout>
  );
};
