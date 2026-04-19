import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
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
import { sendMagicLink } from '@/features/auth/api';
import { type TypedAuthError } from '@/features/auth/errors';
import { magicLinkSchema, type MagicLinkInput } from '@/features/auth/schemas';

export const MagicLinkForm = () => {
  const { t } = useTranslation();

  const form = useForm<MagicLinkInput>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: { email: '' },
  });

  const mutation = useMutation<void, TypedAuthError, MagicLinkInput>({
    mutationFn: sendMagicLink,
    onSuccess: () => {
      toast.success(t('auth.magicLink.emailSent'));
      form.reset();
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
