import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';

import {
  type ConcoursCreateInput,
  concoursCreateSchema,
  DEFAULT_SCORING_RULES,
  VISIBILITY_VALUES,
  type Visibility,
} from './schemas';
import { useCompetitionsQuery, useCreateConcoursMutation } from './use-concours';

const VISIBILITY_HINT_KEY: Record<Visibility, string> = {
  public: 'concours.fields.visibilityPublicHint',
  private: 'concours.fields.visibilityPrivateHint',
  unlisted: 'concours.fields.visibilityUnlistedHint',
};

const VISIBILITY_LABEL_KEY: Record<Visibility, string> = {
  public: 'concours.fields.visibilityPublic',
  private: 'concours.fields.visibilityPrivate',
  unlisted: 'concours.fields.visibilityUnlisted',
};

export const ConcoursNewPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id;

  const competitionsQuery = useCompetitionsQuery();
  const createMutation = useCreateConcoursMutation(userId);

  const form = useForm<ConcoursCreateInput>({
    resolver: zodResolver(concoursCreateSchema),
    defaultValues: {
      nom: '',
      description: undefined,
      competition_id: '',
      visibility: 'public',
      scoring_rules: DEFAULT_SCORING_RULES,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    createMutation.mutate(values, {
      onSuccess: (created) => {
        toast.success(t('concours.create.successTitle'), {
          description: t('concours.create.successBody'),
        });
        navigate(`/app/concours/${created.id}`);
      },
      onError: () => {
        toast.error(t('concours.toast.createError'));
      },
    });
  });

  const competitions = competitionsQuery.data ?? [];

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Button asChild variant="ghost" size="sm" className="self-start px-2">
          <Link to="/app/concours">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            {t('concours.actions.back')}
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('concours.create.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('concours.create.subtitle')}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('concours.title')}</CardTitle>
          <CardDescription>{t('concours.create.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
              <FormField
                control={form.control}
                name="nom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('concours.fields.nom')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('concours.fields.nomPlaceholder')}
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage>
                      {form.formState.errors.nom?.message
                        ? t(form.formState.errors.nom.message)
                        : null}
                    </FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('concours.fields.description')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('concours.fields.descriptionPlaceholder')}
                        rows={4}
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage>
                      {form.formState.errors.description?.message
                        ? t(form.formState.errors.description.message)
                        : null}
                    </FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="competition_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('concours.fields.competition')}</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        disabled={competitionsQuery.isLoading}
                        className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="" disabled>
                          {t('concours.fields.competitionPlaceholder')}
                        </option>
                        {competitions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nom}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage>
                      {form.formState.errors.competition_id?.message
                        ? t(form.formState.errors.competition_id.message)
                        : null}
                    </FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('concours.fields.visibility')}</FormLabel>
                    <FormControl>
                      <div
                        role="radiogroup"
                        aria-label={t('concours.fields.visibility')}
                        className="grid gap-2 sm:grid-cols-3"
                      >
                        {VISIBILITY_VALUES.map((v) => {
                          const checked = field.value === v;
                          return (
                            <label
                              key={v}
                              className={`flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-left transition-colors ${
                                checked
                                  ? 'border-primary bg-primary/5'
                                  : 'border-input hover:border-primary/40'
                              }`}
                            >
                              <span className="flex items-center gap-2 text-sm font-medium">
                                <input
                                  type="radio"
                                  name={field.name}
                                  value={v}
                                  checked={checked}
                                  onChange={() => field.onChange(v)}
                                  className="h-4 w-4"
                                />
                                {t(VISIBILITY_LABEL_KEY[v])}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {t(VISIBILITY_HINT_KEY[v])}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </FormControl>
                    <FormMessage>
                      {form.formState.errors.visibility?.message
                        ? t(form.formState.errors.visibility.message)
                        : null}
                    </FormMessage>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button asChild type="button" variant="ghost">
                  <Link to="/app/concours">{t('common.cancel')}</Link>
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      {t('concours.create.submitting')}
                    </>
                  ) : (
                    t('concours.create.submit')
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </section>
  );
};
