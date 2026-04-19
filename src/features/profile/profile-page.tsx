import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { FullScreenSpinner } from '@/components/common/full-screen-spinner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { Label } from '@/components/ui/label';
import { profileUpdateSchema, type ProfileUpdateInput } from '@/features/profile/schemas';
import { useProfileQuery, useUpdateProfileMutation } from '@/features/profile/use-profile';
import { useAuth } from '@/hooks/use-auth';

const pickInitials = (first?: string | null, last?: string | null, email?: string | null) => {
  const f = (first ?? '').trim()[0];
  const l = (last ?? '').trim()[0];
  if (f || l) return `${f ?? ''}${l ?? ''}`.toUpperCase();
  const fromEmail = (email ?? '').trim()[0];
  return (fromEmail ?? '?').toUpperCase();
};

export const ProfilePage = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id;
  const profileQuery = useProfileQuery(userId);
  const updateMutation = useUpdateProfileMutation(userId);

  const form = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: { prenom: '', nom: '', locale: 'fr' },
  });

  // Hydrate le form dès que le profil est chargé.
  useEffect(() => {
    const p = profileQuery.data;
    if (!p) return;
    form.reset({
      prenom: p.prenom ?? '',
      nom: p.nom ?? '',
      locale: (p.locale === 'en' ? 'en' : 'fr'),
    });
  }, [profileQuery.data, form]);

  if (profileQuery.isLoading || !profileQuery.data) {
    if (profileQuery.isError) {
      return (
        <section className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{t('profile.title')}</h1>
          <p className="text-sm text-destructive">{t('profile.loadError')}</p>
        </section>
      );
    }
    return <FullScreenSpinner />;
  }

  const profile = profileQuery.data;
  const initials = pickInitials(profile.prenom, profile.nom, profile.email);
  const roleLabel =
    profile.role === 'admin' ? t('profile.roleAdmin') : t('profile.rolePlayer');

  const onSubmit = form.handleSubmit((values) => {
    updateMutation.mutate(values, {
      onSuccess: () => {
        // Sync la langue de l'UI sur le nouveau choix user.
        if (values.locale !== i18n.language.split('-')[0]) {
          void i18n.changeLanguage(values.locale);
        }
        toast.success(t('profile.updateSuccess'));
      },
      onError: () => {
        toast.error(t('profile.updateError'));
      },
    });
  });

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">{t('profile.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('profile.subtitle')}</p>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col gap-1">
            <CardTitle className="text-lg">
              {[profile.prenom, profile.nom].filter(Boolean).join(' ') || profile.email}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 text-xs">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              {roleLabel}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-2">
            <Label htmlFor="profile-email">{t('profile.emailLabel')}</Label>
            <Input
              id="profile-email"
              type="email"
              value={profile.email}
              readOnly
              disabled
              aria-describedby="profile-email-hint"
            />
            <p id="profile-email-hint" className="text-xs text-muted-foreground">
              {t('profile.emailReadonlyHint')}
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="prenom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.fields.prenom')}</FormLabel>
                      <FormControl>
                        <Input autoComplete="given-name" {...field} />
                      </FormControl>
                      <FormMessage>
                        {form.formState.errors.prenom?.message
                          ? t(form.formState.errors.prenom.message)
                          : null}
                      </FormMessage>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.fields.nom')}</FormLabel>
                      <FormControl>
                        <Input autoComplete="family-name" {...field} />
                      </FormControl>
                      <FormMessage>
                        {form.formState.errors.nom?.message
                          ? t(form.formState.errors.nom.message)
                          : null}
                      </FormMessage>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="locale"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('locale.label')}</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="fr">{t('locale.fr')}</option>
                        <option value="en">{t('locale.en')}</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={updateMutation.isPending || !form.formState.isDirty}
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      {t('common.saving')}
                    </>
                  ) : (
                    t('common.save')
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
