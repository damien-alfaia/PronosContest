import { Compass, Flame, ShieldCheck, Swords, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { type IncomingChallengeRow } from './api';
import { type UserJokerWithCatalog, pickLocalized } from './schemas';
import { useBoussoleScoreQuery } from './use-jokers';

/**
 * Rangée de badges jokers affichée au-dessus des scores dans la
 * `MatchCard` (Sprint 8.C.1). Elle synthétise :
 *
 *   - les jokers que l'utilisateur a consommés sur CE match (multiplier
 *     `double`/`triple`, `safety_net`, `boussole`) ;
 *   - les challenges reçus des autres participants sur ce match (code
 *     `challenge` ou `double_down`).
 *
 * Volontairement rangée et non grille : l'encart doit rester discret,
 * on préfère une ligne qui wrappe si nécessaire. Les composants sont
 * rendus dans un `role="list"` avec des `role="listitem"` pour que les
 * lecteurs d'écran l'énumèrent explicitement.
 *
 * La boussole a besoin d'une query additionnelle (RPC `boussole_most_common_score`)
 * — on garde le hook interne et on le gate via `enabled` pour ne pas
 * tirer la donnée si le user n'a pas de `boussole` consommée.
 */

type JokerDisplay = {
  /** Code catalog : `double`, `triple`, `safety_net`, `boussole`. */
  code: string;
  /** Libellé court affiché dans le badge. */
  label: string;
  /** Icône lucide-react résolue. */
  Icon: typeof Flame;
  /** Classes Tailwind complètes pour la teinte. */
  styles: string;
};

const JOKER_STYLE_BY_CODE: Record<string, string> = {
  double:
    'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  triple:
    'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-100',
  safety_net:
    'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  boussole:
    'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200',
};

const CHALLENGE_STYLES =
  'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200';

/**
 * Concatène prénom + nom avec fallback propre. Retourne `null` si les
 * deux sont vides (le Select du picker masque déjà les profils sans
 * nom, mais on garde une garde défensive).
 */
const formatFromName = (
  prenom: string | null,
  nom: string | null,
): string | null => {
  const p = prenom?.trim() ?? '';
  const n = nom?.trim() ?? '';
  if (!p && !n) return null;
  return `${p}${p && n ? ' ' : ''}${n}`.trim();
};

/**
 * Lit le `stakes` d'un payload challenge (5 pour `challenge`, 10 pour
 * `double_down`). Si la migration 8.B.1 n'a pas été relancée ou si la
 * payload est vide, fallback sur la valeur par défaut selon le code.
 */
const readStakes = (
  payload: Record<string, unknown> | null,
  code: string,
): number => {
  const raw = payload?.['stakes'];
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return code === 'double_down' ? 10 : 5;
};

export type MatchJokersBadgesProps = {
  /**
   * Jokers que l'utilisateur courant a consommés sur CE match.
   * Pré-filtré côté `PronosGridPage` pour limiter la surface : la
   * normalisation Zod est déjà faite.
   */
  usedByMe: UserJokerWithCatalog[];
  /**
   * Challenges reçus sur ce match (l'utilisateur courant est la cible).
   * Pré-filtré côté `PronosGridPage`, peut être vide.
   */
  incomingChallenges: IncomingChallengeRow[];
  /** Utilisé par la boussole pour interroger la RPC SQL côté serveur. */
  concoursId: string;
  matchId: string;
};

/**
 * Composant d'affichage des effets jokers sur un match.
 * Ne s'affiche que si au moins un badge est à rendre — sinon retourne
 * `null` pour ne pas polluer la `MatchCard`.
 */
export const MatchJokersBadges = ({
  usedByMe,
  incomingChallenges,
  concoursId,
  matchId,
}: MatchJokersBadgesProps) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('en') ? 'en' : 'fr';

  // On cherche le slot boussole parmi les jokers consommés par l'user
  // sur ce match — la RPC n'est déclenchée que si le slot existe.
  const hasBoussole = usedByMe.some((uj) => uj.joker_code === 'boussole');
  const boussoleQuery = useBoussoleScoreQuery(concoursId, matchId, {
    enabled: hasBoussole,
  });

  // Rien à rendre → on court-circuite pour ne pas ajouter de noeuds DOM
  // vides dans la MatchCard.
  if (usedByMe.length === 0 && incomingChallenges.length === 0) {
    return null;
  }

  // Construit la liste des tuiles à afficher côté "mes jokers consommés".
  const myDisplays: JokerDisplay[] = usedByMe
    .map((uj): JokerDisplay | null => {
      const code = uj.joker_code;
      const libelle = pickLocalized(uj.joker.libelle, lang);
      switch (code) {
        case 'double':
          return {
            code,
            label: t('jokers.display.multiplier', { factor: 2 }),
            Icon: Flame,
            styles: JOKER_STYLE_BY_CODE.double as string,
          };
        case 'triple':
          return {
            code,
            label: t('jokers.display.multiplier', { factor: 3 }),
            Icon: Zap,
            styles: JOKER_STYLE_BY_CODE.triple as string,
          };
        case 'safety_net':
          return {
            code,
            label: t('jokers.display.safetyNet'),
            Icon: ShieldCheck,
            styles: JOKER_STYLE_BY_CODE.safety_net as string,
          };
        case 'boussole':
          return {
            code,
            label: libelle, // la boussole rend son propre encart riche ci-dessous
            Icon: Compass,
            styles: JOKER_STYLE_BY_CODE.boussole as string,
          };
        default:
          // Autres codes (challenge, double_down, gift) sont rendus
          // différemment (via `incomingChallenges`) ou non affichés ici.
          return null;
      }
    })
    .filter((d): d is JokerDisplay => d !== null);

  return (
    <div
      role="list"
      aria-label={t('jokers.display.ariaLabel')}
      className="flex flex-wrap items-center gap-1.5"
    >
      {myDisplays.map((d) => {
        if (d.code === 'boussole') {
          // Badge boussole enrichi avec l'agrégat du score majoritaire.
          const boussoleScore = boussoleQuery.data;
          return (
            <Badge
              key={d.code}
              role="listitem"
              variant="outline"
              data-joker-code={d.code}
              className={cn(
                'flex items-center gap-1 text-[11px]',
                d.styles,
              )}
            >
              <d.Icon className="h-3 w-3" aria-hidden />
              {boussoleQuery.isLoading ? (
                <span>{t('jokers.display.boussoleLoading')}</span>
              ) : boussoleScore ? (
                <span>
                  {t('jokers.display.boussoleResult', {
                    scoreA: boussoleScore.score_a,
                    scoreB: boussoleScore.score_b,
                    count: boussoleScore.count,
                  })}
                </span>
              ) : (
                <span>{t('jokers.display.boussoleEmpty')}</span>
              )}
            </Badge>
          );
        }
        return (
          <Badge
            key={d.code}
            role="listitem"
            variant="outline"
            data-joker-code={d.code}
            className={cn(
              'flex items-center gap-1 text-[11px]',
              d.styles,
            )}
          >
            <d.Icon className="h-3 w-3" aria-hidden />
            <span>{d.label}</span>
          </Badge>
        );
      })}

      {incomingChallenges.map((ch) => {
        const fromName = formatFromName(ch.from_prenom, ch.from_nom);
        const stakes = readStakes(ch.used_payload, ch.joker_code);
        const label =
          ch.joker_code === 'double_down'
            ? t('jokers.display.doubleDownReceived', {
                from: fromName ?? t('jokers.display.unknownPlayer'),
                stakes,
              })
            : t('jokers.display.challengeReceived', {
                from: fromName ?? t('jokers.display.unknownPlayer'),
                stakes,
              });
        return (
          <Badge
            key={ch.id}
            role="listitem"
            variant="outline"
            data-joker-code={ch.joker_code}
            className={cn(
              'flex items-center gap-1 text-[11px]',
              CHALLENGE_STYLES,
            )}
          >
            <Swords className="h-3 w-3" aria-hidden />
            <span>{label}</span>
          </Badge>
        );
      })}
    </div>
  );
};
