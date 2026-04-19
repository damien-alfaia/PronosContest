import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { sendResetPasswordEmail } from '@/features/auth/api';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { type TypedAuthError } from '@/features/auth/errors';
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from '@/features/auth/schemas';

export const ForgotPasswordPage = () => {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const mutation = useMutation<void, TypedAuthError, ForgotPasswordInput>({
    mutationFn: sendResetPasswordEmail,
    onSuccess: () => setSent(true),
    onError: (err) => {
      // Par principe on reste volontairement flou : on affiche le même état
      // que si ça avait marché (éviter l'enumeration de comptes).
      if (err.code === 'rate_limited' || err.code === 'network') {
        toast.error(t(err.i18nKey));
      } else {
        setSent(true);
      }
    },
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <AuthLayout
      title={t('auth.forgot.title')}
      subtitle={t('auth.forgot.subtitle')}
      footer={
        <Link
          to="/auth/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t('auth.forgot.backToLogin')}
        </Link>
      }
    >
      {sent ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          {t('auth.forgot.emailSent')}
        </p>
      ) : (
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('auth.fields.email')}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder={t('auth.fields.emailPlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage>
                    {form.formState.errors.email?.message
                      ? t(form.formState.errors.email.message)
                      : null}
                  </FormMessage>
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.submitting')}
                </>
              ) : (
                t('auth.forgot.submit')
              )}
            </Button>
          </form>
        </Form>
      )}
    </AuthLayout>
  );
};
