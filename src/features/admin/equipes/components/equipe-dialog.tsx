import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Equipe } from '@/features/admin/equipes/api';
import {
  type EquipeUpsertInput,
  equipeUpsertSchema,
} from '@/features/admin/equipes/schemas';
import {
  useCreateEquipeMutation,
  useUpdateEquipeMutation,
} from '@/features/admin/equipes/use-admin-equipes';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` = création ; `Equipe` = édition. */
  equipe: Equipe | null;
  /** Toujours requis : la compétition ancre l'équipe. */
  competitionId: string;
};

/**
 * Dialog unifié création / édition d'une équipe.
 *
 * En mode création → `competition_id` vient de la page parente.
 * En mode édition → le champ `competition_id` est verrouillé côté
 * UI (disabled + readOnly). Le trigger SQL empêche de toute façon le
 * transfert de compétition.
 */
export const EquipeDialog = ({
  open,
  onOpenChange,
  equipe,
  competitionId,
}: Props) => {
  const { t } = useTranslation();
  const isEdit = equipe !== null;
  const createMutation = useCreateEquipeMutation(competitionId);
  const updateMutation = useUpdateEquipeMutation(competitionId);
  const mutation = isEdit ? updateMutation : createMutation;

  const form = useForm<EquipeUpsertInput>({
    resolver: zodResolver(equipeUpsertSchema),
    defaultValues: buildDefaults(equipe, competitionId),
  });

  useEffect(() => {
    if (!open) return;
    form.reset(buildDefaults(equipe, competitionId));
    const id = window.setTimeout(() => {
      const el = document.getElementById('equipe-code');
      if (el instanceof HTMLInputElement) el.focus();
    }, 50);
    return () => window.clearTimeout(id);
  }, [open, equipe, competitionId, form]);

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
          ? t('admin.toast.equipeUpdated')
          : t('admin.toast.equipeCreated'),
      );
      onOpenChange(false);
    };
    const onError = (err: unknown) => {
      const msg = err instanceof Error ? err.message : '';
      if (/duplicate key|unique constraint/i.test(msg)) {
        toast.error(t('admin.toast.equipeCodeExists'));
      } else if (msg.includes('move equipe')) {
        toast.error(t('admin.toast.equipeCompetitionLocked'));
      } else {
        toast.error(
          isEdit
            ? t('admin.toast.equipeUpdateError')
            : t('admin.toast.equipeCreateError'),
        );
      }
    };

    if (isEdit && equipe) {
      updateMutation.mutate(
        { id: equipe.id, input: values },
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
      aria-labelledby="admin-equipe-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-xl">
        <header className="mb-4 flex flex-col gap-1">
          <h2
            id="admin-equipe-dialog-title"
            className="text-lg font-semibold"
          >
            {isEdit
              ? t('admin.equipes.dialog.editTitle')
              : t('admin.equipes.dialog.createTitle')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('admin.equipes.dialog.subtitle')}
          </p>
        </header>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <input type="hidden" {...form.register('competition_id')} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[120px_1fr]">
            <div className="flex flex-col gap-1">
              <Label htmlFor="equipe-code">
                {t('admin.equipes.fields.code')}
              </Label>
              <Input
                id="equipe-code"
                {...form.register('code')}
                placeholder="FRA"
                autoCapitalize="characters"
                autoCorrect="off"
                style={{ textTransform: 'uppercase' }}
              />
              {errors.code?.message ? (
                <p className="text-xs text-destructive">
                  {t(errors.code.message)}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="equipe-nom">
                {t('admin.equipes.fields.nom')}
              </Label>
              <Input id="equipe-nom" {...form.register('nom')} />
              {errors.nom?.message ? (
                <p className="text-xs text-destructive">
                  {t(errors.nom.message)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="equipe-groupe">
                {t('admin.equipes.fields.groupe')}
              </Label>
              <Input
                id="equipe-groupe"
                {...form.register('groupe')}
                placeholder="A"
                maxLength={1}
                style={{ textTransform: 'uppercase' }}
              />
              {errors.groupe?.message ? (
                <p className="text-xs text-destructive">
                  {t(errors.groupe.message)}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="equipe-fifa_id">
                {t('admin.equipes.fields.fifaId')}
              </Label>
              <Input
                id="equipe-fifa_id"
                type="number"
                min={1}
                inputMode="numeric"
                {...form.register('fifa_id')}
              />
              {errors.fifa_id?.message ? (
                <p className="text-xs text-destructive">
                  {t(errors.fifa_id.message)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="equipe-drapeau_url">
              {t('admin.equipes.fields.drapeauUrl')}
            </Label>
            <Input
              id="equipe-drapeau_url"
              type="url"
              placeholder="https://..."
              {...form.register('drapeau_url')}
            />
            {errors.drapeau_url?.message ? (
              <p className="text-xs text-destructive">
                {t(errors.drapeau_url.message)}
              </p>
            ) : null}
          </div>

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
//  Helpers
// ------------------------------------------------------------------

const buildDefaults = (
  equipe: Equipe | null,
  competitionId: string,
): EquipeUpsertInput => ({
  competition_id: equipe?.competition_id ?? competitionId,
  code: equipe?.code ?? '',
  nom: equipe?.nom ?? '',
  groupe: equipe?.groupe ?? null,
  drapeau_url: equipe?.drapeau_url ?? null,
  fifa_id: equipe?.fifa_id ?? null,
});
