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
import { signInWithPassword } from '@/features/auth/api';
import { type TypedAuthError } from '@/features/auth/errors';
import { loginSchema, type LoginInput } from '@/features/auth/schemas';

type Props = {
  /** Chemin vers lequel rediriger après login (default /app/dashboard) */
  redirectTo?: string;
};

export const PasswordLoginForm = ({ redirectTo = '/app/dashboard' }: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const mutation = useMutation<unknown, TypedAuthError, LoginInput>({
    mutationFn: signInWithPassword,
    onSuccess: () => {
      navigate(redirectTo, { replace: true });
    },
    onError: (err) => {
      toast.error(t(err.i18nKey));
    },
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return (
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
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.fields.password')}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder={t('auth.fields.passwordPlaceholder')}
                  {...field}
                />
              </FormControl>
              <FormMessage>
                {form.formState.errors.password?.message
                  ? t(form.formState.errors.password.message)
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
            t('auth.login.submit')
          )}
        </Button>
      </form>
    </Form>
  );
};
