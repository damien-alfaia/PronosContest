import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { AdminMatchRow, Equipe } from '@/features/admin/matchs/api';
import {
  type AssignMatchTeamsInput,
  assignMatchTeamsSchema,
} from '@/features/admin/matchs/schemas';
import {
  useEquipesForCompetitionQuery,
  useUpdateMatchTeamsMutation,
} from '@/features/admin/matchs/use-admin-matchs';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: AdminMatchRow;
  competitionId: string | undefined;
};

/**
 * Dialog d'assignation / changement d'équipes pour un match.
 *
 * Cas typique : un match KO seedé en placeholder dont les qualifiés
 * sont désormais connus (après la phase de groupes).
 *
 * Règles métier exposées dans l'UI :
 *   - les 2 équipes doivent être différentes (CHECK SQL + raffine Zod),
 *   - on peut "dé-assigner" en repassant à "—" (null),
 *   - un match `finished` est bloqué côté trigger SQL → si la mutation
 *     échoue avec ce motif, on affiche un toast explicite.
 */
export const MatchTeamsDialog = ({
  open,
  onOpenChange,
  match,
  competitionId,
}: Props) => {
  const { t } = useTranslation();
  const firstSelectRef = useRef<HTMLSelectElement | null>(null);
  const equipesQuery = useEquipesForCompetitionQuery(competitionId);
  const mutation = useUpdateMatchTeamsMutation(competitionId);

  const form = useForm<AssignMatchTeamsInput>({
    resolver: zodResolver(assignMatchTeamsSchema),
    defaultValues: {
      match_id: match.id,
      equipe_a_id: match.equipe_a_id,
      equipe_b_id: match.equipe_b_id,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      match_id: match.id,
      equipe_a_id: match.equipe_a_id,
      equipe_b_id: match.equipe_b_id,
    });
    const id = window.setTimeout(() => firstSelectRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open, match, form]);

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
    mutation.mutate(values, {
      onSuccess: () => {
        toast.success(t('admin.toast.teamsSaved'));
        onOpenChange(false);
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('finished match')) {
          toast.error(t('admin.toast.finishedMatchLocked'));
        } else if (msg.includes('matchs_equipes_distinct')) {
          toast.error(t('admin.errors.equipesMustDiffer'));
        } else {
          toast.error(t('admin.toast.teamsSaveError'));
        }
      },
    });
  });

  const equipes = equipesQuery.data ?? [];
  const unassignedLabel = t('admin.matchs.teamsDialog.unassigned');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-match-teams-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-xl">
        <header className="mb-4 flex flex-col gap-1">
          <h2
            id="admin-match-teams-title"
            className="text-lg font-semibold"
          >
            {t('admin.matchs.teamsDialog.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('admin.matchs.teamsDialog.subtitle')}
          </p>
        </header>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="equipe_a_select">
              {t('admin.matchs.teamsDialog.teamA')}
            </Label>
            <TeamSelect
              id="equipe_a_select"
              selectRef={firstSelectRef}
              value={form.watch('equipe_a_id')}
              equipes={equipes}
              disabled={equipesQuery.isLoading}
              unassignedLabel={unassignedLabel}
              onChange={(v) =>
                form.setValue('equipe_a_id', v, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="equipe_b_select">
              {t('admin.matchs.teamsDialog.teamB')}
            </Label>
            <TeamSelect
              id="equipe_b_select"
              value={form.watch('equipe_b_id')}
              equipes={equipes}
              disabled={equipesQuery.isLoading}
              unassignedLabel={unassignedLabel}
              onChange={(v) =>
                form.setValue('equipe_b_id', v, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            />
            {form.formState.errors.equipe_b_id?.message ? (
              <p className="text-xs text-destructive">
                {t(form.formState.errors.equipe_b_id.message)}
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
//  Select d'équipe (privé au fichier)
// ------------------------------------------------------------------

type TeamSelectProps = {
  id: string;
  value: string | null;
  equipes: Equipe[];
  disabled?: boolean;
  unassignedLabel: string;
  selectRef?: React.RefObject<HTMLSelectElement>;
  onChange: (v: string | null) => void;
};

const TeamSelect = ({
  id,
  value,
  equipes,
  disabled,
  unassignedLabel,
  selectRef,
  onChange,
}: TeamSelectProps) => (
  <select
    id={id}
    ref={selectRef}
    disabled={disabled}
    value={value ?? ''}
    onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
    className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
  >
    <option value="">— {unassignedLabel} —</option>
    {equipes.map((e) => (
      <option key={e.id} value={e.id}>
        {e.groupe ? `${e.groupe.toUpperCase()} · ` : ''}
        {e.nom}
      </option>
    ))}
  </select>
);
