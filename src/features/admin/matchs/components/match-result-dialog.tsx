import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
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
import { Label } from '@/components/ui/label';
import type { AdminMatchRow } from '@/features/admin/matchs/api';
import {
  type UpdateMatchResultInput,
  updateMatchResultSchema,
} from '@/features/admin/matchs/schemas';
import { useUpdateMatchResultMutation } from '@/features/admin/matchs/use-admin-matchs';
import { type MatchPhase, isKoPhase } from '@/features/pronos/schemas';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: AdminMatchRow;
  competitionId: string | undefined;
};

/**
 * Dialog de saisie / correction du résultat d'un match.
 *
 * - Préremplie avec les valeurs existantes du match (si re-saisie).
 * - Affiche les inputs de TAB (vainqueur + scores) uniquement en phase
 *   KO ET si les scores affichés sont égaux.
 * - Par défaut la mutation passe `status: 'finished'` → déclenche le
 *   scoring. Le bouton "Enregistrer en live" permet d'afficher un score
 *   intermédiaire sans figer le classement.
 *
 * UX : même motif léger que `JoinByCodeDialog` (overlay + focus mgmt
 * manuel, pas de Radix Dialog en dépendance).
 */
export const MatchResultDialog = ({
  open,
  onOpenChange,
  match,
  competitionId,
}: Props) => {
  const { t } = useTranslation();
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const mutation = useUpdateMatchResultMutation(competitionId);

  const phase = match.phase as MatchPhase;
  const ko = isKoPhase(phase);

  const form = useForm<UpdateMatchResultInput>({
    resolver: zodResolver(updateMatchResultSchema),
    defaultValues: {
      match_id: match.id,
      phase,
      score_a: match.score_a ?? 0,
      score_b: match.score_b ?? 0,
      vainqueur_tab: (match.vainqueur_tab as 'a' | 'b' | null) ?? null,
      penalty_score_a: match.penalty_score_a,
      penalty_score_b: match.penalty_score_b,
      status: 'finished',
    },
  });

  // Reset à chaque ouverture pour repartir sur les valeurs actuelles
  // du match (si l'admin rouvre sur un match différent, ou après une
  // erreur de saisie).
  useEffect(() => {
    if (!open) return;
    form.reset({
      match_id: match.id,
      phase,
      score_a: match.score_a ?? 0,
      score_b: match.score_b ?? 0,
      vainqueur_tab: (match.vainqueur_tab as 'a' | 'b' | null) ?? null,
      penalty_score_a: match.penalty_score_a,
      penalty_score_b: match.penalty_score_b,
      status: 'finished',
    });
    const id = window.setTimeout(() => firstInputRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open, match, phase, form]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  // Scores courants observés (watch) pour afficher/masquer les inputs
  // vainqueur_tab / pénos en temps réel.
  const scoreA = form.watch('score_a');
  const scoreB = form.watch('score_b');
  const isDraw = Number(scoreA) === Number(scoreB);
  const showVainqueurTab = ko && isDraw;
  const showPenalties = ko && isDraw;

  // Si on bascule en "non-KO" ou "scores différents", on nettoie le
  // vainqueur_tab pour éviter une erreur Zod au submit.
  useEffect(() => {
    if (!showVainqueurTab && form.getValues('vainqueur_tab') !== null) {
      form.setValue('vainqueur_tab', null, { shouldValidate: false });
    }
  }, [showVainqueurTab, form]);

  if (!open) return null;

  const submitWithStatus = (status: 'live' | 'finished') =>
    form.handleSubmit((values) => {
      const payload: UpdateMatchResultInput = { ...values, status };
      mutation.mutate(payload, {
        onSuccess: () => {
          toast.success(
            status === 'finished'
              ? t('admin.toast.resultSavedFinished')
              : t('admin.toast.resultSavedLive'),
          );
          onOpenChange(false);
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : '';
          if (msg.includes('finished match')) {
            toast.error(t('admin.toast.finishedMatchLocked'));
          } else {
            toast.error(t('admin.toast.resultSaveError'));
          }
        },
      });
    });

  const teamALabel = match.equipe_a?.nom ?? t('admin.matchs.placeholderTeam');
  const teamBLabel = match.equipe_b?.nom ?? t('admin.matchs.placeholderTeam');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-match-result-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-xl">
        <header className="mb-4 flex flex-col gap-1">
          <h2
            id="admin-match-result-title"
            className="text-lg font-semibold"
          >
            {t('admin.matchs.resultDialog.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(`pronos.phase.${phase}`)} · {teamALabel} vs {teamBLabel}
          </p>
        </header>

        <Form {...form}>
          <form
            onSubmit={submitWithStatus('finished')}
            className="flex flex-col gap-4"
            noValidate
          >
            {/* Scores principaux */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <FormField
                control={form.control}
                name="score_a"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="score_a">{teamALabel}</FormLabel>
                    <FormControl>
                      <Input
                        id="score_a"
                        type="number"
                        min={0}
                        max={99}
                        inputMode="numeric"
                        {...field}
                        ref={(el) => {
                          field.ref(el);
                          firstInputRef.current = el;
                        }}
                        value={field.value ?? 0}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ''
                              ? 0
                              : Number(e.target.value),
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage>
                      {form.formState.errors.score_a?.message
                        ? t(form.formState.errors.score_a.message)
                        : null}
                    </FormMessage>
                  </FormItem>
                )}
              />
              <span className="pb-3 text-lg font-semibold text-muted-foreground">
                –
              </span>
              <FormField
                control={form.control}
                name="score_b"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="score_b">{teamBLabel}</FormLabel>
                    <FormControl>
                      <Input
                        id="score_b"
                        type="number"
                        min={0}
                        max={99}
                        inputMode="numeric"
                        {...field}
                        value={field.value ?? 0}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ''
                              ? 0
                              : Number(e.target.value),
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage>
                      {form.formState.errors.score_b?.message
                        ? t(form.formState.errors.score_b.message)
                        : null}
                    </FormMessage>
                  </FormItem>
                )}
              />
            </div>

            {/* Vainqueur aux TAB (KO + égalité uniquement) */}
            {showVainqueurTab ? (
              <fieldset className="flex flex-col gap-2 rounded-md border border-dashed p-3">
                <legend className="px-1 text-xs font-medium text-muted-foreground">
                  {t('admin.matchs.resultDialog.vainqueurTabLegend')}
                </legend>
                <div className="flex gap-2">
                  {(['a', 'b'] as const).map((side) => {
                    const selected = form.watch('vainqueur_tab') === side;
                    const label = side === 'a' ? teamALabel : teamBLabel;
                    return (
                      <button
                        key={side}
                        type="button"
                        onClick={() =>
                          form.setValue('vainqueur_tab', side, {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        }
                        className={cn(
                          'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                          selected
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'text-muted-foreground hover:bg-muted',
                        )}
                        aria-pressed={selected}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {form.formState.errors.vainqueur_tab?.message ? (
                  <p className="text-xs text-destructive">
                    {t(form.formState.errors.vainqueur_tab.message)}
                  </p>
                ) : null}
              </fieldset>
            ) : null}

            {/* Pénos (optionnels, KO + égalité) */}
            {showPenalties ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="penalty_score_a">
                    {t('admin.matchs.resultDialog.penaltyA')}
                  </Label>
                  <Input
                    id="penalty_score_a"
                    type="number"
                    min={0}
                    max={30}
                    inputMode="numeric"
                    value={form.watch('penalty_score_a') ?? ''}
                    onChange={(e) =>
                      form.setValue(
                        'penalty_score_a',
                        e.target.value === ''
                          ? null
                          : Number(e.target.value),
                        { shouldValidate: true, shouldDirty: true },
                      )
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="penalty_score_b">
                    {t('admin.matchs.resultDialog.penaltyB')}
                  </Label>
                  <Input
                    id="penalty_score_b"
                    type="number"
                    min={0}
                    max={30}
                    inputMode="numeric"
                    value={form.watch('penalty_score_b') ?? ''}
                    onChange={(e) =>
                      form.setValue(
                        'penalty_score_b',
                        e.target.value === ''
                          ? null
                          : Number(e.target.value),
                        { shouldValidate: true, shouldDirty: true },
                      )
                    }
                  />
                  {form.formState.errors.penalty_score_b?.message ? (
                    <p className="text-xs text-destructive">
                      {t(form.formState.errors.penalty_score_b.message)}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={submitWithStatus('live')}
                disabled={mutation.isPending}
              >
                {t('admin.matchs.resultDialog.saveLive')}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden
                    />
                    {t('common.saving')}
                  </>
                ) : (
                  t('admin.matchs.resultDialog.saveFinished')
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};
