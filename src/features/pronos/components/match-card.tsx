import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Loader2, Lock, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCountdown } from '@/hooks/use-countdown';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { cn } from '@/lib/utils';

import type { MatchWithEquipes, Prono } from '../api';
import {
  type MatchPhase,
  type PronoFormInput,
  type VainqueurTab,
  isKoPhase,
  pronoFormSchema,
} from '../schemas';
import {
  useDeletePronoMutation,
  useUpsertPronoMutation,
} from '../use-pronos';

type Props = {
  match: MatchWithEquipes;
  existing: Prono | undefined;
  concoursId: string;
  userId: string | undefined;
  /** Désactive la saisie (ex : visiteur non-membre du concours). */
  disabled?: boolean;
};

const AUTO_SAVE_DELAY_MS = 600;

/**
 * Formate un coup d'envoi dans la locale utilisateur.
 * On garde l'intl natif (pas de date-fns en dépendance).
 */
const formatKickOff = (iso: string, locale: string): string => {
  const d = new Date(iso);
  const loc = locale.split('-')[0] === 'en' ? 'en-GB' : 'fr-FR';
  return d.toLocaleString(loc, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Formate le décompte en texte court ("2j 3h" / "58min" / "<1min").
 * La précision s'adapte à la durée restante.
 */
const formatCountdown = (
  state: { days: number; hours: number; minutes: number; locked: boolean },
  t: (key: string, values?: Record<string, unknown>) => string,
): string => {
  if (state.locked) return t('pronos.locked');
  if (state.days > 0) {
    return t('pronos.countdown.daysHours', { d: state.days, h: state.hours });
  }
  if (state.hours > 0) {
    return t('pronos.countdown.hoursMinutes', {
      h: state.hours,
      m: state.minutes,
    });
  }
  if (state.minutes > 0) {
    return t('pronos.countdown.minutes', { m: state.minutes });
  }
  return t('pronos.countdown.soon');
};

/**
 * Valeurs de départ pour react-hook-form.
 * Si un prono existe, on le pré-remplit ; sinon tout est vide sauf la phase.
 */
const makeDefaults = (
  match: MatchWithEquipes,
  existing: Prono | undefined,
): PronoFormInput => ({
  phase: match.phase as MatchPhase,
  score_a: existing?.score_a ?? 0,
  score_b: existing?.score_b ?? 0,
  vainqueur_tab: (existing?.vainqueur_tab as VainqueurTab | null) ?? null,
});

export const MatchCard = ({
  match,
  existing,
  concoursId,
  userId,
  disabled = false,
}: Props) => {
  const { t, i18n } = useTranslation();
  const countdown = useCountdown(match.kick_off_at);
  const locked = countdown.locked;

  const upsertMutation = useUpsertPronoMutation(userId, concoursId);
  const deleteMutation = useDeletePronoMutation(userId, concoursId);

  // Feedback visuel discret : ✓ pendant ~1.5s après un save réussi.
  const [justSaved, setJustSaved] = useState(false);
  const justSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<PronoFormInput>({
    resolver: zodResolver(pronoFormSchema),
    defaultValues: makeDefaults(match, existing),
    mode: 'onChange',
  });

  // Si un prono arrive via refetch (optimistic → server), on resync
  // la valeur initiale du form — mais seulement si l'utilisateur n'a
  // pas encore touché au champ (sinon on écraserait sa saisie).
  useEffect(() => {
    if (form.formState.isDirty) return;
    form.reset(makeDefaults(match, existing));
    // Ne pas inclure `form` : sa ref change à chaque render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.score_a, existing?.score_b, existing?.vainqueur_tab, match.id]);

  // ----- Auto-save debouncée -----
  const debouncedSave = useDebouncedCallback(async () => {
    if (locked || disabled || !userId) return;
    const result = pronoFormSchema.safeParse(form.getValues());
    if (!result.success) return;

    try {
      await upsertMutation.mutateAsync({
        concours_id: concoursId,
        match_id: match.id,
        phase: match.phase as MatchPhase,
        score_a: result.data.score_a,
        score_b: result.data.score_b,
        vainqueur_tab: result.data.vainqueur_tab,
      });
      // Reset dirty après succès : on repart propre pour le prochain delta.
      form.reset(result.data, { keepValues: true });
      setJustSaved(true);
      if (justSavedTimerRef.current) clearTimeout(justSavedTimerRef.current);
      justSavedTimerRef.current = setTimeout(() => setJustSaved(false), 1500);
    } catch {
      // L'optimistic update gère le rollback ; on ne bloque pas la saisie.
    }
  }, AUTO_SAVE_DELAY_MS);

  useEffect(() => {
    // Subscribe sur les changements de valeur utilisateur uniquement.
    const subscription = form.watch((_values, { type }) => {
      if (type !== 'change') return;
      debouncedSave.run();
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSave.run]);

  // Flush au démontage pour ne pas perdre une saisie en attente.
  useEffect(() => {
    const flush = debouncedSave.flush;
    return () => {
      flush();
      if (justSavedTimerRef.current) clearTimeout(justSavedTimerRef.current);
    };
  }, [debouncedSave.flush]);

  // ----- Vainqueur TAB visible si KO + égalité -----
  const scoreA = form.watch('score_a');
  const scoreB = form.watch('score_b');
  const ko = isKoPhase(match.phase as MatchPhase);
  const isDraw = Number(scoreA) === Number(scoreB);
  const showTabRadio = ko && isDraw;

  // Si on passe de "égalité KO" à "non égalité" : reset vainqueur_tab.
  useEffect(() => {
    if (!ko || !isDraw) {
      if (form.getValues('vainqueur_tab') !== null) {
        form.setValue('vainqueur_tab', null, { shouldDirty: true });
      }
    }
  }, [ko, isDraw, form]);

  const vainqueurTab = form.watch('vainqueur_tab');

  const handleDelete = async () => {
    if (!userId || locked || disabled) return;
    try {
      await deleteMutation.mutateAsync({
        concours_id: concoursId,
        match_id: match.id,
      });
      form.reset({
        phase: match.phase as MatchPhase,
        score_a: 0,
        score_b: 0,
        vainqueur_tab: null,
      });
    } catch {
      /* rollback géré dans la mutation */
    }
  };

  const phaseLabel = t(`pronos.phase.${match.phase}`);
  const groupLabel = match.equipe_a.groupe
    ? t('pronos.group', { letter: match.equipe_a.groupe.toUpperCase() })
    : null;
  const roundLabel = match.round ? t('pronos.round', { n: match.round }) : null;

  const isSaving = upsertMutation.isPending;
  const errors = form.formState.errors;

  const hasExisting = Boolean(existing);
  const readOnly = locked || disabled;

  return (
    <Card
      className={cn(
        'flex flex-col gap-2 transition-colors',
        locked ? 'border-muted' : 'hover:border-primary/40',
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 p-4 pb-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {groupLabel && (
            <Badge variant="muted" className="text-[10px] uppercase">
              {groupLabel}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">{phaseLabel}</span>
          {roundLabel && (
            <span className="text-xs text-muted-foreground">· {roundLabel}</span>
          )}
        </div>
        <div
          className="flex items-center gap-1 text-xs"
          aria-live="polite"
          aria-atomic="true"
        >
          {locked ? (
            <Badge variant="muted" className="flex items-center gap-1">
              <Lock className="h-3 w-3" aria-hidden />
              {t('pronos.locked')}
            </Badge>
          ) : (
            <span className="text-muted-foreground">
              {formatCountdown(countdown, t)}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 p-4 pt-2">
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex items-center justify-between gap-3"
        >
          {/* Équipe A */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {match.equipe_a.drapeau_url && (
              <img
                src={match.equipe_a.drapeau_url}
                alt=""
                aria-hidden
                className="h-5 w-8 rounded-sm object-cover"
              />
            )}
            <span className="truncate text-sm font-medium">
              {match.equipe_a.nom}
            </span>
          </div>

          {/* Scores */}
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              step={1}
              disabled={readOnly}
              aria-label={t('pronos.scoreFor', { team: match.equipe_a.nom })}
              aria-invalid={Boolean(errors.score_a)}
              className="h-10 w-14 text-center text-base font-semibold"
              {...form.register('score_a', { valueAsNumber: true })}
            />
            <span className="text-muted-foreground" aria-hidden>
              –
            </span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              step={1}
              disabled={readOnly}
              aria-label={t('pronos.scoreFor', { team: match.equipe_b.nom })}
              aria-invalid={Boolean(errors.score_b)}
              className="h-10 w-14 text-center text-base font-semibold"
              {...form.register('score_b', { valueAsNumber: true })}
            />
          </div>

          {/* Équipe B */}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <span className="truncate text-right text-sm font-medium">
              {match.equipe_b.nom}
            </span>
            {match.equipe_b.drapeau_url && (
              <img
                src={match.equipe_b.drapeau_url}
                alt=""
                aria-hidden
                className="h-5 w-8 rounded-sm object-cover"
              />
            )}
          </div>
        </form>

        {/* Radio Vainqueur TAB — uniquement KO + égalité */}
        {showTabRadio && (
          <fieldset
            className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-2"
            aria-invalid={Boolean(errors.vainqueur_tab)}
          >
            <legend className="px-1 text-xs text-muted-foreground">
              {t('pronos.vainqueurTab.legend')}
            </legend>
            {(['a', 'b'] as const).map((side) => {
              const label = side === 'a' ? match.equipe_a.nom : match.equipe_b.nom;
              const checked = vainqueurTab === side;
              return (
                <label
                  key={side}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-xs transition-colors',
                    checked
                      ? 'border-primary bg-primary/5'
                      : 'border-input hover:border-primary/40',
                    readOnly && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <input
                    type="radio"
                    name={`vainqueur_tab_${match.id}`}
                    value={side}
                    checked={checked}
                    disabled={readOnly}
                    onChange={() =>
                      form.setValue('vainqueur_tab', side, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    className="h-3 w-3"
                  />
                  {label}
                </label>
              );
            })}
          </fieldset>
        )}

        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="truncate">
            {match.venue_name && <span>{match.venue_name} · </span>}
            <span>{formatKickOff(match.kick_off_at, i18n.language)}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Feedback save discret */}
            {!readOnly && (
              <span aria-live="polite" className="flex items-center gap-1">
                {isSaving && (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                )}
                {justSaved && !isSaving && (
                  <Check
                    className="h-3 w-3 text-emerald-500"
                    aria-label={t('pronos.saved')}
                  />
                )}
              </span>
            )}

            {/* Effacer : seulement si un prono a été enregistré */}
            {hasExisting && !readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                aria-label={t('pronos.actions.delete')}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">{t('pronos.actions.delete')}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Erreurs de validation (rare : Zod catche la cohérence vainqueur_tab) */}
        {errors.vainqueur_tab?.message && (
          <p className="text-xs text-destructive" role="alert">
            {t(errors.vainqueur_tab.message)}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
