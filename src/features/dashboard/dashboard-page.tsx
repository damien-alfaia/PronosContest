import {
  ArrowRight,
  BarChart3,
  KeyRound,
  Loader2,
  Plus,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { JoinByCodeDialog } from '@/features/concours/components/join-by-code-dialog';
import { useMyConcoursQuery } from '@/features/concours/use-concours';
import {
  useUserBadgesCountQuery,
  useUserBadgesQuery,
} from '@/features/badges/use-badges';
import { pickLocalized } from '@/features/badges/schemas';
import { useAuth } from '@/hooks/use-auth';

/**
 * Nombre max de concours et de badges affichés sur le dashboard.
 * Le reste est accessible via "Voir tous" vers la page dédiée.
 */
const MAX_CONCOURS = 3;
const MAX_BADGES = 3;

export const DashboardPage = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id;

  const [joinOpen, setJoinOpen] = useState(false);

  const myConcoursQuery = useMyConcoursQuery(userId);
  const userBadgesQuery = useUserBadgesQuery(userId);
  const userBadgesCountQuery = useUserBadgesCountQuery(userId);

  const displayName =
    (user?.user_metadata?.prenom as string | undefined) ??
    user?.email?.split('@')[0] ??
    '';

  const concours = myConcoursQuery.data ?? [];
  const concoursVisible = concours.slice(0, MAX_CONCOURS);
  const concoursHiddenCount = Math.max(0, concours.length - MAX_CONCOURS);

  const badges = userBadgesQuery.data ?? [];
  const badgesVisible = badges.slice(0, MAX_BADGES);
  const badgesCount = userBadgesCountQuery.data ?? 0;

  const lang = i18n.language.startsWith('en') ? 'en' : 'fr';

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">
          {t('dashboard.welcome', { name: displayName })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('dashboard.subtitle')}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ================================================= */}
        {/*  Colonne principale — Mes concours                 */}
        {/* ================================================= */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Trophy
                className="h-5 w-5 text-primary"
                aria-hidden
              />
              <CardTitle>{t('dashboard.myConcours.title')}</CardTitle>
            </div>
            {concours.length > 0 ? (
              <Button asChild variant="ghost" size="sm">
                <Link to="/app/concours">
                  {t('dashboard.myConcours.seeAll')}
                  <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
                </Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {myConcoursQuery.isLoading ? (
              <p
                className="flex items-center gap-2 text-sm text-muted-foreground"
                role="status"
              >
                <Loader2
                  className="h-4 w-4 animate-spin"
                  aria-hidden
                />
                {t('dashboard.loading')}
              </p>
            ) : myConcoursQuery.isError ? (
              <p className="text-sm text-destructive">
                {t('dashboard.loadError')}
              </p>
            ) : concours.length === 0 ? (
              <div className="flex flex-col items-start gap-3 rounded-md border border-dashed p-6 text-sm">
                <p className="text-muted-foreground">
                  {t('dashboard.myConcours.empty')}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link to="/app/concours/nouveau">
                      <Plus className="mr-2 h-4 w-4" aria-hidden />
                      {t('dashboard.quickActions.create')}
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setJoinOpen(true)}
                  >
                    <KeyRound className="mr-2 h-4 w-4" aria-hidden />
                    {t('dashboard.quickActions.joinByCode')}
                  </Button>
                </div>
              </div>
            ) : (
              <ul
                className="flex flex-col gap-3"
                aria-label={t('dashboard.myConcours.title')}
              >
                {concoursVisible.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <Link
                        to={`/app/concours/${c.id}`}
                        className="truncate font-medium hover:underline"
                      >
                        {c.nom}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.competition.nom}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button asChild size="sm" variant="secondary">
                        <Link to={`/app/concours/${c.id}/pronos`}>
                          <Target
                            className="mr-1.5 h-4 w-4"
                            aria-hidden
                          />
                          {t('dashboard.myConcours.pronos')}
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/app/concours/${c.id}/classement`}>
                          <BarChart3
                            className="mr-1.5 h-4 w-4"
                            aria-hidden
                          />
                          {t('dashboard.myConcours.classement')}
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
                {concoursHiddenCount > 0 ? (
                  <li className="text-center text-xs text-muted-foreground">
                    {t('dashboard.myConcours.moreCount', {
                      count: concoursHiddenCount,
                    })}
                  </li>
                ) : null}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ================================================= */}
        {/*  Colonne latérale — Actions + Badges               */}
        {/* ================================================= */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('dashboard.quickActions.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button asChild>
                <Link to="/app/concours/nouveau">
                  <Plus className="mr-2 h-4 w-4" aria-hidden />
                  {t('dashboard.quickActions.create')}
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setJoinOpen(true)}
              >
                <KeyRound className="mr-2 h-4 w-4" aria-hidden />
                {t('dashboard.quickActions.joinByCode')}
              </Button>
              <Button asChild variant="ghost">
                <Link to="/app/concours">
                  {t('dashboard.quickActions.browse')}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <Sparkles
                  className="h-5 w-5 text-amber-500"
                  aria-hidden
                />
                <CardTitle className="text-base">
                  {t('dashboard.badges.title')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {userBadgesCountQuery.isSuccess ? (
                <CardDescription className="mb-3">
                  {t('dashboard.badges.count', { count: badgesCount })}
                </CardDescription>
              ) : null}
              {userBadgesQuery.isLoading ? (
                <p
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  role="status"
                >
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden
                  />
                  {t('dashboard.loading')}
                </p>
              ) : userBadgesQuery.isError ? (
                <p className="text-sm text-destructive">
                  {t('dashboard.loadError')}
                </p>
              ) : badges.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.badges.empty')}
                </p>
              ) : (
                <>
                  <ul
                    className="flex flex-col gap-2"
                    aria-label={t('dashboard.badges.title')}
                  >
                    {badgesVisible.map((ub) => (
                      <li
                        key={ub.badge.code}
                        className="flex items-center gap-2 rounded-md border px-3 py-2"
                      >
                        <span className="truncate text-sm font-medium">
                          {pickLocalized(ub.badge.libelle, lang)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Separator className="my-3" />
                  <Button asChild variant="ghost" size="sm" className="w-full">
                    <Link to="/app/profile">
                      {t('dashboard.badges.seeAll')}
                      <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <JoinByCodeDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </section>
  );
};
