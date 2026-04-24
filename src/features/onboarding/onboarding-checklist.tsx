import { CheckCircle2, Circle, Rocket, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, type To } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useProfileQuery } from '@/features/profile/use-profile';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

import {
  checklistProgress,
  computeMilestones,
  type OnboardingMilestones,
} from './schemas';
import {
  useDismissChecklistMutation,
  useOnboardingProgressQuery,
} from './use-onboarding';

/**
 * OnboardingChecklist — carte d'activation affichée sur le dashboard
 * tant que les 5 milestones FTUE ne sont pas tous franchis (sauf si
 * l'user a cliqué "Masquer").
 *
 * 5 tâches, dans cet ordre :
 *   1. Rejoindre un concours
 *   2. Saisir un pronostic
 *   3. Voir le classement
 *   4. Compléter le profil (prenom + nom au minimum)
 *   5. Inviter un ami
 *
 * Visibilité :
 *   - masquée si tout fait OU checklist_dismissed_at non-null
 *   - masquée si l'user n'est pas authentifié (cas improbable — la page
 *     Dashboard est déjà derrière RequireAuth)
 *   - masquée pendant le loading initial (évite le flash d'apparition)
 *
 * Le composant est autonome (fetch sa propre query) pour rester simple
 * à intégrer ailleurs plus tard (ex : fiche concours si on veut pousser
 * l'invitation d'un ami depuis le classement).
 */
export function OnboardingChecklist() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id;

  const progressQuery = useOnboardingProgressQuery(userId);
  const profileQuery = useProfileQuery(userId);
  const dismissMutation = useDismissChecklistMutation();

  // Ne rien rendre tant qu'on n'a pas les données — évite le flash
  // "checklist vide" au premier render.
  if (!userId || progressQuery.isLoading || profileQuery.isLoading) return null;

  const milestones = computeMilestones(progressQuery.data, profileQuery.data);
  const { done, total } = checklistProgress(milestones);

  // Visibilité : ne pas afficher si complet ou dismissed
  if (milestones.checklistDismissed) return null;
  if (done === total) return null;

  const tasks = buildTasks(milestones);

  const onDismiss = () => {
    dismissMutation.mutate(userId);
  };

  return (
    <Card className="border-primary/30 bg-brand-gradient-soft">
      <CardHeader className="flex-row items-start justify-between space-y-0 gap-2">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-primary">
            <Rocket className="h-5 w-5" aria-hidden />
          </span>
          <div className="flex flex-col gap-0.5">
            <CardTitle className="text-base">
              {t('onboarding.checklist.title')}
            </CardTitle>
            <CardDescription>
              {t('onboarding.checklist.subtitleProgress', { done, total })}
            </CardDescription>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          aria-label={t('onboarding.checklist.dismiss')}
          disabled={dismissMutation.isPending}
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </CardHeader>

      <CardContent>
        {/* Barre de progression */}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-label={t('onboarding.checklist.subtitleProgress', { done, total })}
          className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-primary/10"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-slow ease-celebration"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>

        <ul role="list" className="flex flex-col gap-2">
          {tasks.map((task) => (
            <ChecklistItem key={task.id} task={task} t={t} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------
//  Task model + factories
// ------------------------------------------------------------------

interface ChecklistTask {
  id:
    | 'join_concours'
    | 'save_prono'
    | 'view_classement'
    | 'complete_profile'
    | 'invite_friend';
  completed: boolean;
  to: To;
}

function buildTasks(m: OnboardingMilestones): ChecklistTask[] {
  return [
    {
      id: 'join_concours',
      completed: m.firstConcoursJoined,
      to: '/app/concours',
    },
    {
      id: 'save_prono',
      completed: m.firstPronoSaved,
      to: '/app/concours',
    },
    {
      id: 'view_classement',
      completed: m.firstClassementViewed,
      to: '/app/concours',
    },
    {
      id: 'complete_profile',
      completed: m.profileCompleted,
      to: '/app/profile',
    },
    {
      id: 'invite_friend',
      completed: m.firstInviteSent,
      to: '/app/concours',
    },
  ];
}

// ------------------------------------------------------------------
//  ChecklistItem
// ------------------------------------------------------------------

interface ChecklistItemProps {
  task: ChecklistTask;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function ChecklistItem({ task, t }: ChecklistItemProps) {
  const Icon = task.completed ? CheckCircle2 : Circle;
  return (
    <li
      role="listitem"
      data-completed={task.completed}
      className={cn(
        'flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2',
        task.completed
          ? 'border-border/60 opacity-70'
          : 'border-border hover:border-primary/40',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Icon
          aria-hidden
          className={cn(
            'h-5 w-5 shrink-0',
            task.completed ? 'text-success' : 'text-muted-foreground',
          )}
        />
        <span
          className={cn(
            'truncate text-sm',
            task.completed && 'line-through decoration-1',
          )}
        >
          {t(`onboarding.checklist.tasks.${task.id}`)}
        </span>
      </div>

      {task.completed ? null : (
        <Button asChild size="sm" variant="ghost" className="shrink-0">
          <Link to={task.to}>
            {t(`onboarding.checklist.taskCtas.${task.id}`)}
          </Link>
        </Button>
      )}
    </li>
  );
}
