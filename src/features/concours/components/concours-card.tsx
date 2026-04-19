import { ArrowRight, Lock, Eye, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { ConcoursWithCompetition } from '../api';

type Props = {
  concours: ConcoursWithCompetition;
  className?: string;
};

const VISIBILITY_ICON = {
  public: Globe,
  private: Lock,
  unlisted: Eye,
} as const;

const VISIBILITY_VARIANT = {
  public: 'success',
  private: 'warning',
  unlisted: 'muted',
} as const;

/**
 * Card récap d'un concours (liste "Mes concours" + "Découvrir").
 * Lien vers la page détail. Accessible (wrapper <Link> + aria-label).
 */
export const ConcoursCard = ({ concours, className }: Props) => {
  const { t } = useTranslation();
  const VisibilityIcon = VISIBILITY_ICON[concours.visibility as keyof typeof VISIBILITY_ICON];
  const visibilityVariant =
    VISIBILITY_VARIANT[concours.visibility as keyof typeof VISIBILITY_VARIANT];
  const competitionName = concours.competition?.nom ?? '—';

  return (
    <Card
      className={cn(
        'relative flex flex-col transition-colors hover:border-primary/40',
        className,
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">{concours.nom}</CardTitle>
          <CardDescription className="text-xs">{competitionName}</CardDescription>
        </div>
        <Badge variant={visibilityVariant} className="flex items-center gap-1">
          {VisibilityIcon ? (
            <VisibilityIcon className="h-3 w-3" aria-hidden />
          ) : null}
          {t(`concours.visibility.${concours.visibility}`)}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        {concours.description ? (
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {concours.description}
          </p>
        ) : (
          <span aria-hidden />
        )}

        <Link
          to={`/app/concours/${concours.id}`}
          className="inline-flex items-center justify-between gap-2 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
          aria-label={`${t('concours.list.viewDetails')} — ${concours.nom}`}
        >
          {t('concours.list.viewDetails')}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  );
};
