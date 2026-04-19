import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
import { updatePassword } from '@/features/auth/api';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { type TypedAuthError } from '@/features/auth/errors';
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from '@/features/auth/schemas';

export const ResetPasswordPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const mutation = useMutation<void, TypedAuthError, ResetPasswordInput>({
    mutationFn: updatePassword,
    onSuccess: () => {
      toast.success(t('auth.reset.success'));
      setTimeout(() => navigate('/app/dashboard', { replace: true }), 600);
    },
    onError: (err) => {
      toast.error(t(err.i18nKey));
    },
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));
  const err = (field: keyof ResetPasswordInput) => {
    const msg = form.formState.errors[field]?.message;
    return msg ? t(msg) : null;
  };

  return (
    <AuthLayout title={t('auth.reset.title')} subtitle={t('auth.reset.subtitle')}>
      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.fields.password')}</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage>{err('password')}</FormMessage>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.fields.confirmPassword')}</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage>{err('confirmPassword')}</FormMessage>
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
              t('auth.reset.submit')
            )}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
};
