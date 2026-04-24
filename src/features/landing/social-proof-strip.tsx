import { ClipboardCheck, Trophy, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import { useLandingStatsQuery } from './use-landing-stats';

/**
 * SocialProofStrip — bloc "X concours · Y pronos · Z joueurs"
 * affiché sur la landing pour donner un signal de traction.
 *
 * États :
 *   - loading   : skeleton discret (3 pill placeholders)
 *   - error     : on n'affiche rien (fallback silencieux — la landing
 *                 ne doit pas montrer d'erreur technique aux visiteurs)
 *   - empty (0) : on n'affiche rien non plus (éviter "0 concours" qui
 *                 signale que l'app est vide)
 *   - normal    : 3 stats avec icône lucide-react + nombre en gras
 *
 * Accessibilité :
 *   - aria-label localisé sur le conteneur (liste de chiffres agrégés)
 *   - role="list" + role="listitem" sur les 3 stats
 *   - chiffres formatés via Intl.NumberFormat (langue détectée via i18n)
 */

export interface SocialProofStripProps {
  className?: string;
}

export function SocialProofStrip({ className }: SocialProofStripProps) {
  const { t, i18n } = useTranslation();
  const query = useLandingStatsQuery();

  const locale = i18n.language || 'fr';
  const formatter = new Intl.NumberFormat(locale);

  if (query.isLoading) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          'flex flex-wrap items-center justify-center gap-6 sm:gap-10',
          className,
        )}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-5 w-28 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (query.isError || !query.data) {
    // Fallback silencieux : pas d'erreur visible sur la landing.
    return null;
  }

  const { nbConcours, nbPronos, nbUsers } = query.data;

  // Empty guard : on n'affiche pas "0 concours" qui casserait l'effet
  // social proof. À l'arrivée des premiers utilisateurs le bloc
  // apparaît naturellement.
  if (nbConcours === 0 && nbPronos === 0 && nbUsers === 0) {
    return null;
  }

  const items = [
    {
      icon: Trophy,
      value: nbConcours,
      label: t('landing.socialProof.concoursLabel', {
        count: nbConcours,
      }),
    },
    {
      icon: ClipboardCheck,
      value: nbPronos,
      label: t('landing.socialProof.pronosLabel', {
        count: nbPronos,
      }),
    },
    {
      icon: Users,
      value: nbUsers,
      label: t('landing.socialProof.usersLabel', {
        count: nbUsers,
      }),
    },
  ];

  return (
    <div
      role="list"
      aria-label={t('landing.socialProof.ariaLabel')}
      className={cn(
        'flex flex-wrap items-center justify-center gap-6 text-sm sm:gap-10',
        className,
      )}
    >
      {items.map(({ icon: Icon, value, label }) => (
        <div
          key={label}
          role="listitem"
          className="flex items-center gap-2 text-muted-foreground"
        >
          <Icon className="h-4 w-4 text-primary" aria-hidden />
          <span className="font-semibold tabular-nums text-foreground">
            {formatter.format(value)}
          </span>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
