import { Loader2, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { useSetConcoursJokersEnabledMutation } from './use-jokers';

type Props = {
  concoursId: string;
  enabled: boolean;
};

/**
 * Carte de contrôle réservée à l'owner (montée conditionnellement dans
 * la page détail). Toggle `concours.jokers_enabled`.
 *
 * - Transition `false → true` : le trigger SQL `jokers_on_concours_enable`
 *   distribue le starter pack à tous les participants déjà inscrits +
 *   backfill les badges unlocks → la section "Mes jokers" se remplit
 *   automatiquement via Realtime.
 * - Transition `true → false` : aucune propagation côté SQL (les jokers
 *   déjà attribués restent). On informe l'owner via un toast.
 *
 * Pas de primitive shadcn Switch dans le projet : on utilise deux
 * boutons côte-à-côte (pattern déjà utilisé ailleurs dans l'app pour
 * le thème / visibilités). Le `variant` indique l'état courant.
 */
export const JokersEnabledToggle = ({ concoursId, enabled }: Props) => {
  const { t } = useTranslation();
  const mutation = useSetConcoursJokersEnabledMutation();

  const onToggle = (next: boolean) => {
    if (next === enabled || mutation.isPending) return;

    mutation.mutate(
      { concoursId, enabled: next },
      {
        onSuccess: () => {
          toast.success(
            next
              ? t('jokers.toggle.toast.enabled')
              : t('jokers.toggle.toast.disabled'),
          );
        },
        onError: () => {
          toast.error(t('jokers.toggle.toast.error'));
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" aria-hidden />
        </div>
        <div className="flex-1">
          <CardTitle className="text-base">
            {t('jokers.toggle.title')}
          </CardTitle>
          <CardDescription>
            {enabled
              ? t('jokers.toggle.descriptionEnabled')
              : t('jokers.toggle.descriptionDisabled')}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div
          role="radiogroup"
          aria-label={t('jokers.toggle.ariaLabel')}
          className="flex gap-2"
        >
          <Button
            type="button"
            size="sm"
            variant={enabled ? 'default' : 'outline'}
            onClick={() => onToggle(true)}
            disabled={mutation.isPending}
            role="radio"
            aria-checked={enabled}
          >
            {mutation.isPending && !enabled ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {t('jokers.toggle.on')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={!enabled ? 'default' : 'outline'}
            onClick={() => onToggle(false)}
            disabled={mutation.isPending}
            role="radio"
            aria-checked={!enabled}
          >
            {mutation.isPending && enabled ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {t('jokers.toggle.off')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('jokers.toggle.hint')}
        </p>
      </CardContent>
    </Card>
  );
};
