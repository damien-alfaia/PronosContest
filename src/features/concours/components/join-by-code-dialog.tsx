import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
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
import { useAuth } from '@/hooks/use-auth';

import { joinByCodeSchema, type JoinByCodeInput } from '../schemas';
import { useJoinByCodeMutation } from '../use-concours';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Modale minimaliste (pas de Radix Dialog en dépendance pour Sprint 2,
 * on se contente d'un overlay + focus management à la main).
 */
export const JoinByCodeDialog = ({ open, onOpenChange }: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const joinMutation = useJoinByCodeMutation(user?.id);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<JoinByCodeInput>({
    resolver: zodResolver(joinByCodeSchema),
    defaultValues: { code: '' },
  });

  useEffect(() => {
    if (!open) {
      form.reset({ code: '' });
      return;
    }
    const id = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open, form]);

  // Fermer au clavier (Esc)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  const onSubmit = form.handleSubmit((values) => {
    joinMutation.mutate(values.code, {
      onSuccess: (concoursId) => {
        toast.success(t('concours.toast.joinSuccess'));
        onOpenChange(false);
        navigate(`/app/concours/${concoursId}`);
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('concours_not_found') || msg.includes('PGRST116')) {
          toast.error(t('concours.toast.joinNotFound'));
        } else if (msg.includes('concours_not_joinable')) {
          toast.error(t('concours.toast.joinNotJoinable'));
        } else {
          toast.error(t('concours.toast.joinError'));
        }
      },
    });
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-code-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-xl">
        <header className="mb-4 flex flex-col gap-1">
          <h2 id="join-code-title" className="text-lg font-semibold">
            {t('concours.join.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('concours.join.subtitle')}</p>
        </header>

        <Form {...form}>
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="join-code-input">
                    {t('concours.fields.codeInvitation')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="join-code-input"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      {...field}
                      ref={(el) => {
                        field.ref(el);
                        inputRef.current = el;
                      }}
                    />
                  </FormControl>
                  <FormMessage>
                    {form.formState.errors.code?.message
                      ? t(form.formState.errors.code.message)
                      : null}
                  </FormMessage>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={joinMutation.isPending}
              >
                {t('concours.join.cancel')}
              </Button>
              <Button type="submit" disabled={joinMutation.isPending}>
                {joinMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    {t('concours.join.submitting')}
                  </>
                ) : (
                  t('concours.join.submit')
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};
