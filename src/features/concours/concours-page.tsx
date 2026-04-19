import { KeyRound, Plus, Search } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';

import { ConcoursCard } from './components/concours-card';
import { JoinByCodeDialog } from './components/join-by-code-dialog';
import { useMyConcoursQuery, usePublicConcoursQuery } from './use-concours';

export const ConcoursPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id;

  const [joinOpen, setJoinOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  // `useDeferredValue` = debounce léger gratuit (la requête suit avec
  // un micro-délai, sans bloquer la frappe). On garde un debounce
  // explicite pour Phase 2.C si besoin plus marqué.
  const deferredSearch = useDeferredValue(searchInput);

  const myConcoursQuery = useMyConcoursQuery(userId);
  const publicConcoursQuery = usePublicConcoursQuery(deferredSearch);

  const myIds = useMemo(
    () => new Set((myConcoursQuery.data ?? []).map((c) => c.id)),
    [myConcoursQuery.data],
  );

  // "Découvrir" exclut ceux dont je suis déjà membre (signal "à découvrir").
  const discoverable = useMemo(() => {
    const all = publicConcoursQuery.data ?? [];
    return all.filter((c) => !myIds.has(c.id));
  }, [publicConcoursQuery.data, myIds]);

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('concours.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('concours.subtitle')}</p>

        <div className="mt-2 flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/app/concours/nouveau">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              {t('concours.actions.create')}
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => setJoinOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" aria-hidden />
            {t('concours.actions.joinByCode')}
          </Button>
        </div>
      </header>

      {/* ------------- MES CONCOURS ------------- */}
      <section className="flex flex-col gap-4" aria-labelledby="concours-mine-heading">
        <div className="flex items-center justify-between">
          <h2 id="concours-mine-heading" className="text-xl font-semibold tracking-tight">
            {t('concours.sections.myConcours')}
          </h2>
        </div>

        {myConcoursQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : (myConcoursQuery.data ?? []).length === 0 ? (
          <div className="flex flex-col gap-1 rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
            <p>{t('concours.empty.mine')}</p>
            <p className="text-xs">{t('concours.empty.mineCta')}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(myConcoursQuery.data ?? []).map((c) => (
              <ConcoursCard key={c.id} concours={c} />
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* ------------- DÉCOUVRIR ------------- */}
      <section
        className="flex flex-col gap-4"
        aria-labelledby="concours-discover-heading"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="concours-discover-heading" className="text-xl font-semibold tracking-tight">
            {t('concours.sections.discover')}
          </h2>

          <div className="flex max-w-sm flex-col gap-1">
            <Label htmlFor="concours-search" className="sr-only">
              {t('concours.search.label')}
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="concours-search"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('concours.search.placeholder')}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {publicConcoursQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : discoverable.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
            {deferredSearch.trim().length > 0
              ? t('concours.empty.search')
              : t('concours.empty.discover')}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {discoverable.map((c) => (
              <ConcoursCard key={c.id} concours={c} />
            ))}
          </div>
        )}
      </section>

      <JoinByCodeDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </section>
  );
};
