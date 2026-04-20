import { ArrowLeft, CalendarClock, Filter, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';

import { FullScreenSpinner } from '@/components/common/full-screen-spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useConcoursDetailQuery } from '@/features/concours/use-concours';
import { useAuth } from '@/hooks/use-auth';
import { getGroupColor } from '@/lib/group-colors';
import { cn } from '@/lib/utils';

import type { MatchWithEquipes, Prono } from './api';
import { MatchCard } from './components/match-card';
import {
  useMatchsQuery,
  useMyPronosInConcoursQuery,
} from './use-pronos';

/**
 * Grille de saisie des pronos pour un concours.
 * - Route protégée par RequireAuth (parent router).
 * - Accès : participant du concours uniquement (sinon redirect vers
 *   la fiche concours publique, où il pourra demander à rejoindre).
 */

type FilterMode = 'all' | 'todo' | 'locked';

const FILTER_MODES: readonly FilterMode[] = ['all', 'todo', 'locked'] as const;

/**
 * Regroupe des matchs par `round` en respectant l'ordre temporel.
 * On garde une Map pour préserver l'ordre d'insertion = ordre chronologique
 * des premières rencontres par round.
 */
const groupByRound = (
  matchs: MatchWithEquipes[],
): Map<number, MatchWithEquipes[]> => {
  const byRound = new Map<number, MatchWithEquipes[]>();
  for (const m of matchs) {
    const key = m.round ?? 0;
    const bucket = byRound.get(key);
    if (bucket) {
      bucket.push(m);
    } else {
      byRound.set(key, [m]);
    }
  }
  return byRound;
};

/**
 * Indexe les pronos par `match_id` pour un lookup O(1) côté rendu.
 */
const indexPronosByMatch = (pronos: Prono[]): Map<string, Prono> => {
  const map = new Map<string, Prono>();
  for (const p of pronos) map.set(p.match_id, p);
  return map;
};

const isMatchLocked = (isoKickOff: string, nowMs: number): boolean =>
  Date.parse(isoKickOff) <= nowMs;

const hasProno = (matchId: string, pronosByMatch: Map<string, Prono>): boolean =>
  pronosByMatch.has(matchId);

export const PronosGridPage = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const userId = user?.id;

  const detailQuery = useConcoursDetailQuery(id);
  const concours = detailQuery.data;

  const competitionId = concours?.competition_id;
  const matchsQuery = useMatchsQuery(competitionId);
  const myPronosQuery = useMyPronosInConcoursQuery(id);

  const [filter, setFilter] = useState<FilterMode>('all');
  const [groupFilter, setGroupFilter] = useState<string | null>(null);

  // Tick léger pour que le filtre "Verrouillés / À pronostiquer"
  // reflète l'écoulement du temps sans attendre un refetch des matchs.
  // La MatchCard a son propre `useCountdown` pour le rendu fin (30s) ;
  // ici on se contente d'un tick minute pour la partition du tableau.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const pronosByMatch = useMemo(
    () => indexPronosByMatch(myPronosQuery.data ?? []),
    [myPronosQuery.data],
  );

  const allGroups = useMemo(() => {
    const set = new Set<string>();
    for (const m of matchsQuery.data ?? []) {
      const g = m.equipe_a.groupe ?? m.equipe_b.groupe;
      if (g) set.add(g.toLowerCase());
    }
    return Array.from(set).sort();
  }, [matchsQuery.data]);

  const filteredMatchs = useMemo(() => {
    const base = matchsQuery.data ?? [];
    return base.filter((m) => {
      // Filtre par groupe (case-insensitive)
      if (groupFilter) {
        const g = (m.equipe_a.groupe ?? '').toLowerCase();
        if (g !== groupFilter) return false;
      }
      // Filtre par statut de saisie
      if (filter === 'todo') {
        if (isMatchLocked(m.kick_off_at, now)) return false;
        if (hasProno(m.id, pronosByMatch)) return false;
        return true;
      }
      if (filter === 'locked') {
        return isMatchLocked(m.kick_off_at, now);
      }
      return true;
    });
  }, [matchsQuery.data, filter, groupFilter, pronosByMatch, now]);

  const grouped = useMemo(() => groupByRound(filteredMatchs), [filteredMatchs]);

  // ---------- Guards ----------

  if (!id) return <Navigate to="/app/concours" replace />;

  if (detailQuery.isLoading) return <FullScreenSpinner />;

  if (detailQuery.isError || !concours) {
    return <Navigate to="/app/concours" replace />;
  }

  // Participant uniquement : sinon redirect vers la fiche publique
  // où il pourra rejoindre (ou voir son erreur).
  const isMember =
    Boolean(userId) && concours.participants.some((p) => p.user_id === userId);
  if (!isMember) {
    return <Navigate to={`/app/concours/${id}`} replace />;
  }

  // ---------- Rendu ----------

  const totalMatchs = matchsQuery.data?.length ?? 0;
  const pronosCount = myPronosQuery.data?.length ?? 0;
  const isLoadingContent = matchsQuery.isLoading || myPronosQuery.isLoading;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      {/* ---------- En-tête ---------- */}
      <div className="flex flex-col gap-3">
        <Button asChild variant="ghost" size="sm" className="self-start">
          <Link to={`/app/concours/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            {t('pronos.backToConcours')}
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t('pronos.title')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {concours.nom} · {concours.competition?.nom ?? '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('pronos.progress', {
                current: pronosCount,
                total: totalMatchs,
              })}
            </p>
          </div>

          <Button asChild variant="outline" size="sm">
            <Link to="/app/classement">
              <Trophy className="mr-2 h-4 w-4" aria-hidden />
              {t('pronos.viewClassement')}
            </Link>
          </Button>
        </div>
      </div>

      <Separator />

      {/* ---------- Filtres ---------- */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div
          role="tablist"
          aria-label={t('pronos.filters.statusLabel')}
          className="flex gap-1 rounded-md border p-1"
        >
          {FILTER_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={filter === mode}
              onClick={() => setFilter(mode)}
              className={cn(
                'rounded-sm px-3 py-1 text-xs font-medium transition-colors',
                filter === mode
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {t(`pronos.filters.${mode}`)}
            </button>
          ))}
        </div>

        {allGroups.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <button
              type="button"
              onClick={() => setGroupFilter(null)}
              className={cn(
                'rounded-sm border px-2 py-0.5 text-[10px] uppercase transition-colors',
                groupFilter === null
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'text-muted-foreground hover:border-primary/40',
              )}
            >
              {t('pronos.filters.allGroups')}
            </button>
            {allGroups.map((g) => {
              const color = getGroupColor(g);
              const active = groupFilter === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroupFilter(g)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px] uppercase transition-colors',
                    active
                      ? cn(color.badge, 'ring-1 ring-offset-1 ring-offset-background')
                      : 'text-muted-foreground hover:border-primary/40',
                  )}
                  aria-pressed={active}
                >
                  <span
                    className={cn('inline-block h-1.5 w-1.5 rounded-full', color.dot)}
                    aria-hidden
                  />
                  {g}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------- Contenu ---------- */}
      {isLoadingContent ? (
        <div className="flex items-center justify-center p-12">
          <FullScreenSpinner />
        </div>
      ) : totalMatchs === 0 ? (
        <EmptyState
          title={t('pronos.empty.title')}
          description={t('pronos.empty.description')}
        />
      ) : filteredMatchs.length === 0 ? (
        <EmptyState
          title={t('pronos.emptyFiltered.title')}
          description={t('pronos.emptyFiltered.description')}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {Array.from(grouped.entries()).map(([round, matchs]) => (
            <section
              key={round}
              aria-label={t('pronos.round', { n: round })}
              className="flex flex-col gap-2"
            >
              <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CalendarClock className="h-4 w-4" aria-hidden />
                {round > 0
                  ? t('pronos.round', { n: round })
                  : t('pronos.roundUnknown')}
                <Badge variant="muted" className="ml-1">
                  {matchs.length}
                </Badge>
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {matchs.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    existing={pronosByMatch.get(match.id)}
                    concoursId={id}
                    userId={userId}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------------
//  Sous-composant local : état vide
// ------------------------------------------------------------------

const EmptyState = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <div className="flex flex-col items-center gap-2 rounded-md border border-dashed p-8 text-center">
    <p className="text-sm font-medium">{title}</p>
    <p className="text-xs text-muted-foreground">{description}</p>
  </div>
);
