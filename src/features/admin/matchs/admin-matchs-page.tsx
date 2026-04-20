import {
  CheckCircle2,
  CircleDot,
  Clock,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  ShieldAlert,
  Users,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { FullScreenSpinner } from '@/components/common/full-screen-spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AdminMatchRow } from '@/features/admin/matchs/api';
import { MatchResultDialog } from '@/features/admin/matchs/components/match-result-dialog';
import { MatchTeamsDialog } from '@/features/admin/matchs/components/match-teams-dialog';
import {
  type MatchStatus,
  MATCH_STATUS_VALUES,
} from '@/features/admin/matchs/schemas';
import {
  useAdminMatchsQuery,
  useResetMatchResultMutation,
  useUpdateMatchStatusMutation,
} from '@/features/admin/matchs/use-admin-matchs';
import { useCompetitionsQuery } from '@/features/concours/use-concours';
import { PHASE_VALUES, type MatchPhase } from '@/features/pronos/schemas';
import { cn } from '@/lib/utils';

/**
 * Page admin — gestion des matchs.
 *
 * Accès : protégé par `<RequireAdmin />` (cf. router).
 *
 * Fonctionnalités :
 *  - Sélection de la compétition (par défaut : la 1re renvoyée par
 *    `listCompetitions`, triée par date_debut croissante).
 *  - Filtres phase + status (client-side, on a 104 matchs max sur WC 2026).
 *  - Table avec actions par ligne :
 *      • Saisir / corriger le résultat (dialog)
 *      • Assigner / changer les équipes (dialog)
 *      • Reporter / Annuler / Remettre en scheduled (mutation rapide)
 *      • Reset (remet en scheduled + efface les scores)
 */

type PhaseFilter = MatchPhase | 'all';
type StatusFilter = MatchStatus | 'all';

const STATUS_BADGE: Record<
  MatchStatus,
  {
    icon: typeof Clock;
    variant: 'default' | 'muted' | 'outline' | 'success' | 'warning';
  }
> = {
  scheduled: { icon: Clock, variant: 'muted' },
  live: { icon: CircleDot, variant: 'default' },
  finished: { icon: CheckCircle2, variant: 'success' },
  postponed: { icon: ShieldAlert, variant: 'warning' },
  cancelled: { icon: XCircle, variant: 'outline' },
};

const formatKickOff = (iso: string, locale: string): string => {
  const d = new Date(iso);
  const loc = locale.split('-')[0] === 'en' ? 'en-GB' : 'fr-FR';
  return d.toLocaleString(loc, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const AdminMatchsPage = () => {
  const { t, i18n } = useTranslation();
  const competitionsQuery = useCompetitionsQuery();
  const competitions = competitionsQuery.data ?? [];

  const [selectedCompetitionId, setSelectedCompetitionId] = useState<
    string | undefined
  >(undefined);

  // Auto-sélection de la première compétition dès qu'elles sont chargées.
  const effectiveCompetitionId =
    selectedCompetitionId ?? competitions[0]?.id;

  const matchsQuery = useAdminMatchsQuery(effectiveCompetitionId);
  const statusMutation = useUpdateMatchStatusMutation(effectiveCompetitionId);
  const resetMutation = useResetMatchResultMutation(effectiveCompetitionId);

  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [resultDialogMatch, setResultDialogMatch] =
    useState<AdminMatchRow | null>(null);
  const [teamsDialogMatch, setTeamsDialogMatch] =
    useState<AdminMatchRow | null>(null);

  const filteredMatchs = useMemo(() => {
    const base = matchsQuery.data ?? [];
    return base.filter((m) => {
      if (phaseFilter !== 'all' && m.phase !== phaseFilter) return false;
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      return true;
    });
  }, [matchsQuery.data, phaseFilter, statusFilter]);

  const counts = useMemo(() => {
    const base = matchsQuery.data ?? [];
    return {
      total: base.length,
      scheduled: base.filter((m) => m.status === 'scheduled').length,
      live: base.filter((m) => m.status === 'live').length,
      finished: base.filter((m) => m.status === 'finished').length,
    };
  }, [matchsQuery.data]);

  const handleQuickStatus = (match: AdminMatchRow, status: MatchStatus) => {
    if (status === 'live' || status === 'finished') {
      // Ces statuts exigent un score → on force l'ouverture du dialog résultat.
      setResultDialogMatch(match);
      return;
    }
    statusMutation.mutate(
      { match_id: match.id, status },
      {
        onSuccess: () => {
          toast.success(t(`admin.toast.statusUpdated.${status}`));
        },
        onError: () => toast.error(t('admin.toast.statusUpdateError')),
      },
    );
  };

  const handleReset = (match: AdminMatchRow) => {
    if (
      !window.confirm(t('admin.matchs.confirmReset'))
    )
      return;
    resetMutation.mutate(match.id, {
      onSuccess: () => toast.success(t('admin.toast.resetSuccess')),
      onError: () => toast.error(t('admin.toast.resetError')),
    });
  };

  if (competitionsQuery.isLoading) return <FullScreenSpinner />;

  if (competitions.length === 0) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">{t('admin.matchs.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('admin.matchs.emptyCompetitions')}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      {/* ---------- En-tête ---------- */}
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">
          {t('admin.matchs.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('admin.matchs.subtitle')}
        </p>
      </header>

      {/* ---------- Sélection de la compétition + compteurs ---------- */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <Label htmlFor="admin-competition-select">
            {t('admin.matchs.competitionLabel')}
          </Label>
          <select
            id="admin-competition-select"
            value={effectiveCompetitionId ?? ''}
            onChange={(e) => setSelectedCompetitionId(e.target.value)}
            className="flex h-10 w-full max-w-sm items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="muted">
            {t('admin.matchs.counts.total', { count: counts.total })}
          </Badge>
          <Badge variant="muted">
            {t('admin.matchs.counts.scheduled', { count: counts.scheduled })}
          </Badge>
          <Badge variant="default">
            {t('admin.matchs.counts.live', { count: counts.live })}
          </Badge>
          <Badge variant="outline">
            {t('admin.matchs.counts.finished', { count: counts.finished })}
          </Badge>
        </div>
      </div>

      <Separator />

      {/* ---------- Filtres ---------- */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-2 text-xs font-medium text-muted-foreground">
            {t('admin.matchs.filters.phaseLabel')}
          </span>
          <FilterChip
            active={phaseFilter === 'all'}
            onClick={() => setPhaseFilter('all')}
            label={t('admin.matchs.filters.allPhases')}
          />
          {PHASE_VALUES.map((p) => (
            <FilterChip
              key={p}
              active={phaseFilter === p}
              onClick={() => setPhaseFilter(p)}
              label={t(`pronos.phase.${p}`)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-2 text-xs font-medium text-muted-foreground">
            {t('admin.matchs.filters.statusLabel')}
          </span>
          <FilterChip
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
            label={t('admin.matchs.filters.allStatuses')}
          />
          {MATCH_STATUS_VALUES.map((s) => (
            <FilterChip
              key={s}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
              label={t(`admin.matchs.status.${s}`)}
            />
          ))}
        </div>
      </div>

      {/* ---------- Table ---------- */}
      {matchsQuery.isLoading ? (
        <div className="flex items-center justify-center p-12">
          <FullScreenSpinner />
        </div>
      ) : filteredMatchs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed p-8 text-center">
          <p className="text-sm font-medium">
            {t('admin.matchs.emptyFiltered.title')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('admin.matchs.emptyFiltered.description')}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.matchs.columns.phase')}</TableHead>
                <TableHead>{t('admin.matchs.columns.kickOff')}</TableHead>
                <TableHead>{t('admin.matchs.columns.teams')}</TableHead>
                <TableHead>{t('admin.matchs.columns.score')}</TableHead>
                <TableHead>{t('admin.matchs.columns.status')}</TableHead>
                <TableHead className="text-right">
                  {t('admin.matchs.columns.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMatchs.map((m) => (
                <AdminMatchRowView
                  key={m.id}
                  match={m}
                  locale={i18n.language}
                  onOpenResult={() => setResultDialogMatch(m)}
                  onOpenTeams={() => setTeamsDialogMatch(m)}
                  onQuickStatus={(s) => handleQuickStatus(m, s)}
                  onReset={() => handleReset(m)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ---------- Dialogs ---------- */}
      {resultDialogMatch ? (
        <MatchResultDialog
          open={Boolean(resultDialogMatch)}
          onOpenChange={(v) => {
            if (!v) setResultDialogMatch(null);
          }}
          match={resultDialogMatch}
          competitionId={effectiveCompetitionId}
        />
      ) : null}
      {teamsDialogMatch ? (
        <MatchTeamsDialog
          open={Boolean(teamsDialogMatch)}
          onOpenChange={(v) => {
            if (!v) setTeamsDialogMatch(null);
          }}
          match={teamsDialogMatch}
          competitionId={effectiveCompetitionId}
        />
      ) : null}
    </section>
  );
};

// ------------------------------------------------------------------
//  Sous-composants locaux
// ------------------------------------------------------------------

const FilterChip = ({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      'rounded-sm border px-2 py-0.5 text-[11px] font-medium transition-colors',
      active
        ? 'border-primary bg-primary/10 text-foreground'
        : 'text-muted-foreground hover:border-primary/40',
    )}
  >
    {label}
  </button>
);

const AdminMatchRowView = ({
  match,
  locale,
  onOpenResult,
  onOpenTeams,
  onQuickStatus,
  onReset,
}: {
  match: AdminMatchRow;
  locale: string;
  onOpenResult: () => void;
  onOpenTeams: () => void;
  onQuickStatus: (status: MatchStatus) => void;
  onReset: () => void;
}) => {
  const { t } = useTranslation();
  const status = match.status as MatchStatus;
  const { icon: StatusIcon, variant } = STATUS_BADGE[status];

  const hasBothTeams = Boolean(match.equipe_a && match.equipe_b);
  const hasScore = match.score_a !== null && match.score_b !== null;
  const canEnterResult = hasBothTeams;

  const teamALabel = match.equipe_a?.nom ?? t('admin.matchs.placeholderTeam');
  const teamBLabel = match.equipe_b?.nom ?? t('admin.matchs.placeholderTeam');

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-xs font-medium text-muted-foreground">
        {t(`pronos.phase.${match.phase}`)}
      </TableCell>
      <TableCell className="whitespace-nowrap font-mono text-xs">
        {formatKickOff(match.kick_off_at, locale)}
      </TableCell>
      <TableCell>
        <div
          className={cn(
            'flex flex-col gap-0.5 text-sm',
            !hasBothTeams && 'text-muted-foreground italic',
          )}
        >
          <span>{teamALabel}</span>
          <span>{teamBLabel}</span>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap font-mono text-sm">
        {hasScore ? (
          <>
            {match.score_a} – {match.score_b}
            {match.vainqueur_tab ? (
              <span className="ml-1 text-xs text-muted-foreground">
                ({t(`admin.matchs.vainqueurTabShort.${match.vainqueur_tab}`)})
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={variant} className="gap-1">
          <StatusIcon className="h-3 w-3" aria-hidden />
          {t(`admin.matchs.status.${status}`)}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenResult}
            disabled={!canEnterResult}
            title={
              canEnterResult
                ? undefined
                : t('admin.matchs.actions.assignFirst')
            }
          >
            <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden />
            {t('admin.matchs.actions.enterResult')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('admin.matchs.actions.moreLabel')}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onOpenTeams}>
                <Users className="mr-2 h-4 w-4" aria-hidden />
                {t('admin.matchs.actions.assignTeams')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onQuickStatus('postponed')}>
                <ShieldAlert className="mr-2 h-4 w-4" aria-hidden />
                {t('admin.matchs.actions.postpone')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onQuickStatus('cancelled')}>
                <XCircle className="mr-2 h-4 w-4" aria-hidden />
                {t('admin.matchs.actions.cancel')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onQuickStatus('scheduled')}>
                <Clock className="mr-2 h-4 w-4" aria-hidden />
                {t('admin.matchs.actions.restoreScheduled')}
              </DropdownMenuItem>
              {(status === 'finished' || status === 'live') && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onReset}
                    className="text-destructive focus:text-destructive"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
                    {t('admin.matchs.actions.resetResult')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
};
