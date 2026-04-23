import { ArrowLeft, Medal, Target, Trophy } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';

import { FullScreenSpinner } from '@/components/common/full-screen-spinner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useConcoursDetailQuery } from '@/features/concours/use-concours';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

import type { ClassementRow } from './schemas';
import {
  useClassementQuery,
  useClassementRealtime,
} from './use-classement';

/**
 * Page Classement d'un concours.
 *
 * Route : `/app/concours/:id/classement`
 *
 * Accès :
 *   - Membre du concours : OK.
 *   - Sinon : redirect vers la fiche concours (où il pourra rejoindre).
 *
 * Fonctionnement :
 *   - `useClassementQuery` récupère la vue agrégée (1 ligne par user).
 *   - `useClassementRealtime` s'abonne à `matchs` UPDATE + `pronos` *
 *     pour invalider la query dès qu'un score / prono change.
 *   - Le tri est déjà fait côté SQL (RANK() + points desc). On se
 *     contente d'afficher tel quel.
 *
 * Accessibilité :
 *   - Table HTML native (captioned via header), navigation au scroll
 *     naturelle, pas d'ARIA custom requis.
 *   - La ligne du user courant est mise en évidence visuellement ET
 *     annotée `aria-label` pour les lecteurs d'écran.
 */

/**
 * Badges de rang pour le podium.
 *
 * On utilise les tokens DS `podium-{gold,silver,bronze}` (définis dans
 * globals.css + tailwind.config.ts) plutôt que les couleurs brutes
 * `amber/slate/orange`, pour rester cohérent avec le reste du système
 * (shadow-accent, badges, etc.) et permettre au dark mode de réajuster
 * automatiquement la lumière via les variables HSL.
 */
const RANK_BADGE_CLASSES: Record<number, string> = {
  1: 'border-transparent bg-podium-gold/20 text-podium-gold shadow-sm dark:bg-podium-gold/25',
  2: 'border-transparent bg-podium-silver/25 text-podium-silver dark:bg-podium-silver/30',
  3: 'border-transparent bg-podium-bronze/20 text-podium-bronze dark:bg-podium-bronze/25',
};

const getRankClass = (rang: number): string | null =>
  RANK_BADGE_CLASSES[rang] ?? null;

const getInitials = (prenom: string | null, nom: string | null): string => {
  const a = (prenom ?? '').trim().charAt(0).toUpperCase();
  const b = (nom ?? '').trim().charAt(0).toUpperCase();
  const initials = `${a}${b}`.trim();
  return initials.length > 0 ? initials : '?';
};

const formatName = (prenom: string | null, nom: string | null): string => {
  const full = [prenom, nom]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ');
  return full.length > 0 ? full : '—';
};

/**
 * Formate un delta challenge signé pour affichage : `+5`, `-10`, `±0`.
 * L'UI s'en sert pour ne pas afficher juste "5" (perte d'info sur le
 * signe) et pour garantir un tabular-nums stable visuellement.
 */
const formatChallengeDelta = (delta: number): string => {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `${delta}`; // le signe "-" est déjà là côté int
  return '±0';
};

/**
 * Teinte Tailwind du badge `challenge_delta` selon le signe.
 * Neutre en dark/light pour le cas 0, vert pour positif, rouge pour négatif.
 * On reste sur des classes complètes pour garantir le tree-shaking de Tailwind.
 */
const challengeDeltaClass = (delta: number): string => {
  if (delta > 0) {
    return 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200';
  }
  if (delta < 0) {
    return 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200';
  }
  return 'border-muted bg-muted/30 text-muted-foreground';
};

export const ConcoursClassementPage = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const userId = user?.id;

  const detailQuery = useConcoursDetailQuery(id);
  const concours = detailQuery.data;

  const classementQuery = useClassementQuery(id);
  useClassementRealtime(id, { enabled: Boolean(id) });

  const isMember = useMemo(
    () =>
      Boolean(
        concours && userId && concours.participants.some((p) => p.user_id === userId),
      ),
    [concours, userId],
  );

  const myRow = useMemo<ClassementRow | undefined>(
    () => classementQuery.data?.find((r) => r.user_id === userId),
    [classementQuery.data, userId],
  );

  // ---------- Guards ----------

  if (!id) return <Navigate to="/app/concours" replace />;

  if (detailQuery.isLoading) return <FullScreenSpinner />;

  if (detailQuery.isError || !concours) {
    return <Navigate to="/app/concours" replace />;
  }

  if (!isMember) {
    return <Navigate to={`/app/concours/${id}`} replace />;
  }

  // ---------- Rendu ----------

  const rows = classementQuery.data ?? [];
  const isLoadingContent = classementQuery.isLoading;
  const hasRows = rows.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      {/* ---------- En-tête ---------- */}
      <div className="flex flex-col gap-3">
        <Button asChild variant="ghost" size="sm" className="self-start">
          <Link to={`/app/concours/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            {t('classement.backToConcours')}
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Trophy className="h-6 w-6 text-podium-gold" aria-hidden />
              {t('classement.title')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {concours.nom} · {concours.competition?.nom ?? '—'}
            </p>
          </div>

          <Button asChild variant="outline" size="sm">
            <Link to={`/app/concours/${id}/pronos`}>
              <Target className="mr-2 h-4 w-4" aria-hidden />
              {t('classement.goToPronos')}
            </Link>
          </Button>
        </div>

        {/* Ma position (shortcut) */}
        {myRow ? (
          <div
            className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm"
            aria-label={t('classement.myPosition')}
          >
            <Medal className="h-4 w-4 text-primary" aria-hidden />
            <span className="font-medium">{t('classement.myPosition')}</span>
            <Badge
              variant="outline"
              className={cn(
                'font-semibold',
                getRankClass(myRow.rang) ?? '',
              )}
            >
              #{myRow.rang}
            </Badge>
            <span className="text-muted-foreground">
              {t('classement.pointsSummary', {
                points: myRow.points,
                exacts: myRow.pronos_exacts,
                gagnes: myRow.pronos_gagnes,
              })}
            </span>
            {myRow.challenge_delta !== 0 ? (
              <Badge
                variant="outline"
                className={cn(
                  'font-semibold tabular-nums',
                  challengeDeltaClass(myRow.challenge_delta),
                )}
                title={t('classement.challengeDeltaTooltip')}
              >
                {t('classement.challengeDeltaLabel', {
                  delta: formatChallengeDelta(myRow.challenge_delta),
                })}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>

      <Separator />

      {/* ---------- Tableau ---------- */}
      {isLoadingContent ? (
        <div className="flex items-center justify-center p-12">
          <FullScreenSpinner />
        </div>
      ) : !hasRows ? (
        <EmptyState
          title={t('classement.empty.title')}
          description={t('classement.empty.description')}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">
                  {t('classement.columns.rank')}
                </TableHead>
                <TableHead>{t('classement.columns.player')}</TableHead>
                <TableHead className="w-20 text-right">
                  {t('classement.columns.points')}
                </TableHead>
                <TableHead
                  className="hidden w-32 text-right md:table-cell"
                  title={t('classement.columns.breakdownTooltip')}
                >
                  {t('classement.columns.breakdown')}
                </TableHead>
                <TableHead className="hidden w-24 text-right md:table-cell">
                  {t('classement.columns.pronosJoues')}
                </TableHead>
                <TableHead className="hidden w-24 text-right md:table-cell">
                  {t('classement.columns.pronosGagnes')}
                </TableHead>
                <TableHead className="w-24 text-right">
                  {t('classement.columns.pronosExacts')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const isMe = row.user_id === userId;
                const rankClass = getRankClass(row.rang);
                return (
                  <TableRow
                    key={row.user_id}
                    className={cn(isMe && 'bg-primary/5 hover:bg-primary/10')}
                    aria-label={
                      isMe ? t('classement.rowMeAriaLabel') : undefined
                    }
                  >
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          'font-semibold tabular-nums',
                          rankClass ?? '',
                        )}
                      >
                        #{row.rang}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          {row.avatar_url ? (
                            <AvatarImage
                              src={row.avatar_url}
                              alt=""
                              aria-hidden
                            />
                          ) : null}
                          <AvatarFallback className="text-xs">
                            {getInitials(row.prenom, row.nom)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span
                            className={cn(
                              'text-sm leading-tight',
                              isMe && 'font-semibold',
                            )}
                          >
                            {formatName(row.prenom, row.nom)}
                          </span>
                          {isMe ? (
                            <span className="text-[10px] uppercase tracking-wide text-primary">
                              {t('classement.youLabel')}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {row.points}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">
                      <div
                        className="flex items-center justify-end gap-1.5"
                        aria-label={t('classement.columns.breakdownAriaLabel', {
                          prono: row.prono_points,
                          delta: formatChallengeDelta(row.challenge_delta),
                        })}
                      >
                        <span className="text-muted-foreground">
                          {row.prono_points}
                        </span>
                        {row.challenge_delta !== 0 ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] tabular-nums',
                              challengeDeltaClass(row.challenge_delta),
                            )}
                          >
                            {formatChallengeDelta(row.challenge_delta)}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/60">
                            ±0
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
                      {row.pronos_joues}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
                      {row.pronos_gagnes}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.pronos_exacts}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
