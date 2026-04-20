import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Competition } from '@/features/admin/competitions/api';
import {
  COMPETITION_STATUS_VALUES,
  type CompetitionUpsertInput,
  competitionUpsertSchema,
  SPORT_VALUES,
} from '@/features/admin/competitions/schemas';
import {
  useCreateCompetitionMutation,
  useUpdateCompetitionMutation,
} from '@/features/admin/competitions/use-admin-competitions';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = mode création ; Competition = mode édition. */
  competition: Competition | null;
};

/**
 * Dialog unifié création / édition d'une compétition.
 *
 * `competition === null` → mode création.
 * `competition !== null` → mode édition (pré-rempli).
 *
 * Les valeurs `null` de la row SQL (date_debut, date_fin, logo_url)
 * sont converties en `''` pour les `<input />` contrôlés ; Zod
 * reconvertit vers `null` à la soumission via le preprocess.
 */
export const CompetitionDialog = ({ open, onOpenChange, competition }: Props) => {
  const { t } = useTranslation();

  const isEdit = competition !== null;
  const createMutation = useCreateCompetitionMutation();
  const updateMutation = useUpdateCompetitionMutation();
  const mutation = isEdit ? updateMutation : createMutation;

  const form = useForm<CompetitionUpsertInput>({
    resolver: zodResolver(competitionUpsertSchema),
    defaultValues: buildDefaults(competition),
  });

  useEffect(() => {
    if (!open) return;
    form.reset(buildDefaults(competition));
    // Focus léger sur le premier champ après le tick de rendu.
    const id = window.setTimeout(() => {
      const el = document.getElementById('code');
      if (el instanceof HTMLInputElement) el.focus();
    }, 50);
    return () => window.clearTimeout(id);
  }, [open, competition, form]);

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
    const onSuccess = () => {
      toast.success(
        isEdit
          ? t('admin.toast.competitionUpdated')
          : t('admin.toast.competitionCreated'),
      );
      onOpenChange(false);
    };
    const onError = (err: unknown) => {
      const msg = err instanceof Error ? err.message : '';
      if (/duplicate key|unique constraint/i.test(msg)) {
        toast.error(t('admin.toast.competitionCodeExists'));
      } else {
        toast.error(
          isEdit
            ? t('admin.toast.competitionUpdateError')
            : t('admin.toast.competitionCreateError'),
        );
      }
    };

    if (isEdit && competition) {
      updateMutation.mutate(
        { id: competition.id, input: values },
        { onSuccess, onError },
      );
    } else {
      createMutation.mutate(values, { onSuccess, onError });
    }
  });

  const errors = form.formState.errors;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-competition-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-xl">
        <header className="mb-4 flex flex-col gap-1">
          <h2
            id="admin-competition-dialog-title"
            className="text-lg font-semibold"
          >
            {isEdit
              ? t('admin.competitions.dialog.editTitle')
              : t('admin.competitions.dialog.createTitle')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('admin.competitions.dialog.subtitle')}
          </p>
        </header>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field
            id="code"
            label={t('admin.competitions.fields.code')}
            hint={t('admin.competitions.fields.codeHint')}
            error={errors.code?.message}
          >
            <Input
              id="code"
              {...form.register('code')}
              placeholder="fifa-wc-2026"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </Field>

          <Field
            id="nom"
            label={t('admin.competitions.fields.nom')}
            error={errors.nom?.message}
          >
            <Input id="nom" {...form.register('nom')} />
          </Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              id="sport"
              label={t('admin.competitions.fields.sport')}
              error={errors.sport?.message}
            >
              <select
                id="sport"
                {...form.register('sport')}
                className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {SPORT_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {t(`admin.competitions.sport.${s}`)}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              id="status"
              label={t('admin.competitions.fields.status')}
              error={errors.status?.message}
            >
              <select
                id="status"
                {...form.register('status')}
                className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {COMPETITION_STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {t(`admin.competitions.competitionStatus.${s}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              id="date_debut"
              label={t('admin.competitions.fields.dateDebut')}
              error={errors.date_debut?.message}
            >
              <Input
                id="date_debut"
                type="date"
                {...form.register('date_debut')}
              />
            </Field>

            <Field
              id="date_fin"
              label={t('admin.competitions.fields.dateFin')}
              error={errors.date_fin?.message}
            >
              <Input
                id="date_fin"
                type="date"
                {...form.register('date_fin')}
              />
            </Field>
          </div>

          <Field
            id="logo_url"
            label={t('admin.competitions.fields.logoUrl')}
            error={errors.logo_url?.message}
          >
            <Input
              id="logo_url"
              type="url"
              placeholder="https://..."
              {...form.register('logo_url')}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !form.formState.isDirty}
            >
              {mutation.isPending ? (
                <>
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden
                  />
                  {t('common.saving')}
                </>
              ) : (
                t('common.save')
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
//  Helpers locaux
// ------------------------------------------------------------------

const buildDefaults = (
  competition: Competition | null,
): CompetitionUpsertInput => ({
  code: competition?.code ?? '',
  nom: competition?.nom ?? '',
  sport: ((competition?.sport as 'football' | 'rugby' | undefined) ??
    'football') as CompetitionUpsertInput['sport'],
  status: ((competition?.status as 'upcoming' | 'live' | 'finished' | undefined) ??
    'upcoming') as CompetitionUpsertInput['status'],
  date_debut: competition?.date_debut ?? null,
  date_fin: competition?.date_fin ?? null,
  logo_url: competition?.logo_url ?? null,
});

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
};

const Field = ({ id, label, hint, error, children }: FieldProps) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{t(error)}</p> : null}
    </div>
  );
};
