import {
  ArrowLeft,
  CalendarDays,
  Check,
  Copy,
  Eye,
  Globe,
  Loader2,
  Lock,
  MessageSquare,
  Shield,
  Target,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { FullScreenSpinner } from '@/components/common/full-screen-spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';

import {
  useConcoursDetailQuery,
  useJoinPublicConcoursMutation,
  useLeaveConcoursMutation,
} from './use-concours';

const VISIBILITY_ICON = {
  public: Globe,
  private: Lock,
  unlisted: Eye,
} as const;

const formatDateRange = (start?: string | null, end?: string | null, locale = 'fr') => {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === 'en' ? 'en-GB' : 'fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  if (!start && !end) return null;
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  return fmt((start ?? end) as string);
};

export const ConcoursDetailPage = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const userId = user?.id;

  const detailQuery = useConcoursDetailQuery(id);
  const joinMutation = useJoinPublicConcoursMutation(userId);
  const leaveMutation = useLeaveConcoursMutation(userId);

  const [copied, setCopied] = useState(false);

  const concours = detailQuery.data;

  const isOwner = useMemo(
    () => Boolean(concours && userId && concours.owner_id === userId),
    [concours, userId],
  );
  const isMember = useMemo(
    () =>
      Boolean(
        concours && userId && concours.participants.some((p) => p.user_id === userId),
      ),
    [concours, userId],
  );

  if (!id) return <Navigate to="/app/concours" replace />;
  if (detailQuery.isLoading) return <FullScreenSpinner />;
  if (detailQuery.isError || !concours) {
    // Pas d'accès ou inexistant : on ramène à la liste.
    return <Navigate to="/app/concours" replace />;
  }

  const VisibilityIcon =
    VISIBILITY_ICON[concours.visibility as keyof typeof VISIBILITY_ICON];
  const dateRange = formatDateRange(
    concours.competition?.date_debut,
    concours.competition?.date_fin,
    i18n.language.split('-')[0],
  );

  const scoring = concours.scoring_rules as Record<string, unknown>;

  const onCopyCode = async () => {
    if (!concours.code_invitation) return;
    try {
      await navigator.clipboard.writeText(concours.code_invitation);
      setCopied(true);
      toast.success(t('concours.actions.copied'));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('concours.toast.joinError'));
    }
  };

  const onJoin = () => {
    joinMutation.mutate(concours.id, {
      onSuccess: () => toast.success(t('concours.toast.joinSuccess')),
      onError: () => toast.error(t('concours.toast.joinError')),
    });
  };

  const onLeave = () => {
    leaveMutation.mutate(concours.id, {
      onSuccess: () => toast.success(t('concours.toast.leaveSuccess')),
      onError: () => toast.error(t('concours.toast.leaveError')),
    });
  };

  const participantCount = concours.participants.length;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Button asChild variant="ghost" size="sm" className="self-start px-2">
          <Link to="/app/concours">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            {t('concours.actions.back')}
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{concours.nom}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                {VisibilityIcon ? (
                  <VisibilityIcon className="h-3 w-3" aria-hidden />
                ) : null}
                {t(`concours.visibility.${concours.visibility}`)}
              </Badge>
              {isOwner ? (
                <Badge variant="success" className="flex items-center gap-1">
                  <Shield className="h-3 w-3" aria-hidden />
                  {t('concours.detail.ownerBadge')}
                </Badge>
              ) : isMember ? (
                <Badge variant="secondary">{t('concours.detail.memberBadge')}</Badge>
              ) : (
                <Badge variant="muted">{t('concours.detail.visitorBadge')}</Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {isMember ? (
              <>
                <Button asChild>
                  <Link to={`/app/concours/${concours.id}/pronos`}>
                    <Target className="mr-2 h-4 w-4" aria-hidden />
                    {t('concours.actions.goToPronos')}
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to={`/app/concours/${concours.id}/classement`}>
                    <Trophy className="mr-2 h-4 w-4" aria-hidden />
                    {t('concours.actions.goToClassement')}
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to={`/app/concours/${concours.id}/chat`}>
                    <MessageSquare className="mr-2 h-4 w-4" aria-hidden />
                    {t('concours.actions.goToChat')}
                  </Link>
                </Button>
              </>
            ) : null}
            {!isMember && concours.visibility === 'public' ? (
              <Button onClick={onJoin} disabled={joinMutation.isPending}>
                {joinMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" aria-hidden />
                )}
                {t('concours.actions.join')}
              </Button>
            ) : null}
            {isMember && !isOwner ? (
              <Button
                variant="outline"
                onClick={onLeave}
                disabled={leaveMutation.isPending}
              >
                {leaveMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <UserMinus className="mr-2 h-4 w-4" aria-hidden />
                )}
                {t('concours.actions.leave')}
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {concours.description ? (
        <p className="text-sm text-muted-foreground">{concours.description}</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Compétition */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <Trophy className="h-5 w-5 text-muted-foreground" aria-hidden />
            <div className="flex-1">
              <CardTitle className="text-base">
                {concours.competition?.nom ?? '—'}
              </CardTitle>
              <CardDescription className="text-xs">
                {concours.competition?.code ?? ''}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {dateRange ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="h-4 w-4" aria-hidden />
                <span>{dateRange}</span>
              </div>
            ) : null}
            {concours.competition?.sport ? (
              <Badge variant="outline" className="w-fit">
                {concours.competition.sport}
              </Badge>
            ) : null}
          </CardContent>
        </Card>

        {/* Participants */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" aria-hidden />
            <div className="flex-1">
              <CardTitle className="text-base">
                {t('concours.sections.participants')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('concours.list.participantsCount', { count: participantCount })}
              </CardDescription>
            </div>
          </CardHeader>
          {isOwner && concours.code_invitation ? (
            <CardContent className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                {t('concours.detail.codeDescription')}
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md border border-input bg-muted px-3 py-2 font-mono text-base font-semibold tracking-widest text-primary">
                  {concours.code_invitation}
                </code>
                <Button type="button" variant="outline" size="sm" onClick={onCopyCode}>
                  {copied ? (
                    <Check className="mr-2 h-4 w-4" aria-hidden />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" aria-hidden />
                  )}
                  {copied ? t('concours.actions.copied') : t('concours.actions.copyCode')}
                </Button>
              </div>
            </CardContent>
          ) : null}
        </Card>
      </div>

      <Separator />

      {/* Scoring */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('concours.sections.scoring')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {(['exact_score', 'correct_winner', 'correct_draw', 'knockout_bonus'] as const).map(
              (key) => {
                const value = scoring?.[key];
                if (typeof value !== 'number') return null;
                return (
                  <div key={key} className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                    <dt className="text-muted-foreground">
                      {t(`concours.scoring.${key}`)}
                    </dt>
                    <dd className="font-semibold">{value}</dd>
                  </div>
                );
              },
            )}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            {scoring?.odds_multiplier_enabled
              ? t('concours.scoring.odds_multiplier_enabled_on')
              : t('concours.scoring.odds_multiplier_enabled_off')}
          </p>
        </CardContent>
      </Card>
    </section>
  );
};
