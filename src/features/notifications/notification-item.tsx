import {
  AtSign,
  Award,
  Bell as BellIcon,
  Gift,
  type LucideIcon,
  Share2,
  Swords,
  Trophy,
  UserPlus,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { cn } from '@/lib/utils';

import { type Notification, type NotificationType } from './schemas';

/**
 * Ligne unitaire d'une notification dans la pop-up cloche.
 *
 * Le titre / body des notifications n'étant pas stocké en base (colonnes
 * `title`/`body` laissées nullables par les triggers), le front compose
 * le rendu à partir de `type` + `payload` via i18n (clés `notifications.
 * types.*`). La porte reste ouverte à des notifs "admin broadcast"
 * futures qui rempliraient title/body en dur — on les afficherait
 * prioritairement si présents.
 *
 * Mark-as-read : explicite au clic (décision produit Sprint 6.C — pas
 * d'auto-mark à l'ouverture de la pop-up). Le clic appelle `onMarkAsRead`
 * fourni par la liste, puis navigue vers la ressource.
 */

// ------------------------------------------------------------------
//  MAPPING TYPE → ICÔNE + TEINTE
// ------------------------------------------------------------------

type TypeVisual = {
  icon: LucideIcon;
  /** Teintes Tailwind light + dark pour l'icône. */
  iconClassName: string;
  /** Teinte du rond de fond derrière l'icône. */
  bgClassName: string;
};

const TYPE_VISUALS: Record<NotificationType, TypeVisual> = {
  match_result: {
    icon: Trophy,
    iconClassName: 'text-amber-700 dark:text-amber-300',
    bgClassName: 'bg-amber-100 dark:bg-amber-950/50',
  },
  badge_earned: {
    icon: Award,
    iconClassName: 'text-purple-700 dark:text-purple-300',
    bgClassName: 'bg-purple-100 dark:bg-purple-950/50',
  },
  concours_new_member: {
    icon: UserPlus,
    iconClassName: 'text-emerald-700 dark:text-emerald-300',
    bgClassName: 'bg-emerald-100 dark:bg-emerald-950/50',
  },
  chat_mention: {
    icon: AtSign,
    iconClassName: 'text-sky-700 dark:text-sky-300',
    bgClassName: 'bg-sky-100 dark:bg-sky-950/50',
  },
  // Jokers sociaux (Sprint 8.C.4) — on reprend la teinte rose du picker
  // de challenge et l'emerald du picker gift, pour garder une cohérence
  // visuelle entre la consommation et la réception.
  challenge_received: {
    icon: Swords,
    iconClassName: 'text-rose-700 dark:text-rose-300',
    bgClassName: 'bg-rose-100 dark:bg-rose-950/50',
  },
  gift_received: {
    icon: Gift,
    iconClassName: 'text-emerald-700 dark:text-emerald-300',
    bgClassName: 'bg-emerald-100 dark:bg-emerald-950/50',
  },
  // Milestone referral (Sprint 9.C.5) — teinte indigo pour faire écho
  // au brand-gradient de la ReferralBanner.
  referral_milestone: {
    icon: Share2,
    iconClassName: 'text-indigo-700 dark:text-indigo-300',
    bgClassName: 'bg-indigo-100 dark:bg-indigo-950/50',
  },
};

// ------------------------------------------------------------------
//  HELPERS — libellé localisé
// ------------------------------------------------------------------

/**
 * Résout le title affiché à partir du `type`. Si le trigger SQL a
 * rempli `title` en dur (cas "admin broadcast" futur), on l'utilise ;
 * sinon on tombe sur le template i18n.
 */
const resolveTitle = (
  n: Notification,
  t: (key: string, options?: Record<string, unknown>) => string,
): string => {
  if (n.title) return n.title;

  switch (n.type) {
    case 'match_result':
      return t('notifications.types.matchResult.title');
    case 'badge_earned':
      return t('notifications.types.badgeEarned.title');
    case 'concours_new_member':
      return t('notifications.types.concoursNewMember.title');
    case 'chat_mention':
      return t('notifications.types.chatMention.title');
    case 'challenge_received':
      return t('notifications.types.challengeReceived.title');
    case 'gift_received':
      return t('notifications.types.giftReceived.title');
    case 'referral_milestone':
      return t('notifications.types.referralMilestone.title');
  }
};

/**
 * Résout le body affiché à partir du `type` + `payload`. Idem : `body`
 * en dur gagne, sinon template.
 */
const resolveBody = (
  n: Notification,
  t: (key: string, options?: Record<string, unknown>) => string,
): string => {
  if (n.body) return n.body;

  switch (n.type) {
    case 'match_result': {
      const { score_a, score_b } = n.payload;
      if (typeof score_a === 'number' && typeof score_b === 'number') {
        return t('notifications.types.matchResult.body.withScore', {
          a: score_a,
          b: score_b,
        });
      }
      return t('notifications.types.matchResult.body.noScore');
    }
    case 'badge_earned':
      return t('notifications.types.badgeEarned.body');
    case 'concours_new_member':
      return t('notifications.types.concoursNewMember.body', {
        concours: n.payload.concours_nom,
      });
    case 'chat_mention':
      return n.payload.body_preview;
    case 'challenge_received': {
      // On choisit le template selon le code du joker pour que le body
      // traduise "challenge 5 pts" vs "double_down 10 pts".
      // Fallback sur `.generic` si jamais un nouveau code 'challenge'
      // apparaît un jour sans clé i18n dédiée — l'UI reste lisible.
      const stakes =
        typeof n.payload.stakes === 'number' ? n.payload.stakes : null;
      if (n.payload.joker_code === 'double_down') {
        return t('notifications.types.challengeReceived.body.doubleDown', {
          stakes: stakes ?? 10,
        });
      }
      if (n.payload.joker_code === 'challenge') {
        return t('notifications.types.challengeReceived.body.challenge', {
          stakes: stakes ?? 5,
        });
      }
      return t('notifications.types.challengeReceived.body.generic', {
        stakes: stakes ?? 0,
      });
    }
    case 'gift_received':
      return t('notifications.types.giftReceived.body', {
        code: n.payload.gifted_joker_code,
      });
    case 'referral_milestone':
      // 2 libellés selon qu'un joker a été offert ou non (dépend du
      // concours où le dernier invité a rejoint : si jokers_enabled=false,
      // la notif reste motivante mais sans joker).
      return n.payload.joker_granted
        ? t('notifications.types.referralMilestone.body.withJoker', {
            count: n.payload.count,
          })
        : t('notifications.types.referralMilestone.body.noJoker', {
            count: n.payload.count,
          });
  }
};

// ------------------------------------------------------------------
//  HELPERS — temps relatif (sans dépendance externe)
// ------------------------------------------------------------------

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Temps écoulé en format compact ("à l'instant", "5 min", "3 h", "2 j",
 * "3 sem", "12/04"). Volontairement court pour tenir dans la pop-up.
 * Seuil < 5 s → "à l'instant" (atténuation du flash entre optimistic
 * update et Realtime).
 */
const formatRelative = (
  isoDate: string,
  lang: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string => {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);

  if (diff < 5 * SECOND) return t('notifications.time.justNow');
  if (diff < MINUTE) {
    const s = Math.round(diff / SECOND);
    return t('notifications.time.seconds', { count: s });
  }
  if (diff < HOUR) {
    const m = Math.round(diff / MINUTE);
    return t('notifications.time.minutes', { count: m });
  }
  if (diff < DAY) {
    const h = Math.round(diff / HOUR);
    return t('notifications.time.hours', { count: h });
  }
  if (diff < WEEK) {
    const d = Math.round(diff / DAY);
    return t('notifications.time.days', { count: d });
  }

  // Au-delà d'une semaine → date courte localisée (ex : "12 avr.").
  return new Date(isoDate).toLocaleDateString(lang, {
    day: 'numeric',
    month: 'short',
  });
};

// ------------------------------------------------------------------
//  HELPERS — routage
// ------------------------------------------------------------------

/**
 * Calcule la route cible d'une notif donnée. On reste conservateur :
 *   - match_result / badge_earned : `/app/profile` (badges) ou `/app/
 *     concours` pour match_result car le payload ne porte pas
 *     d'identifiant de concours (le match appartient à une compétition,
 *     et un user peut être dans plusieurs concours de cette compétition).
 *   - concours_new_member / chat_mention : route directe vers le
 *     concours concerné (payload.concours_id).
 */
const resolveRoute = (n: Notification): string => {
  switch (n.type) {
    case 'match_result':
      return '/app/concours';
    case 'badge_earned':
      return '/app/profile';
    case 'concours_new_member':
      return `/app/concours/${n.payload.concours_id}`;
    case 'chat_mention':
      return `/app/concours/${n.payload.concours_id}/chat`;
    case 'challenge_received':
      // On renvoie directement sur la grille de pronos du concours
      // pour que le destinataire puisse vérifier son prono sur le
      // match ciblé — pas d'URL anchor `?match=...` pour rester
      // robuste tant qu'on n'a pas posé les ancres côté PronosGridPage.
      return `/app/concours/${n.payload.concours_id}/pronos`;
    case 'gift_received':
      // On envoie sur la fiche concours : c'est là que la section
      // "Mes jokers" est visible (sous le toggle owner) et que le
      // nouveau slot apparaît.
      return `/app/concours/${n.payload.concours_id}`;
    case 'referral_milestone':
      // On envoie sur la fiche concours où l'invité a rejoint — c'est
      // là que le joker offert apparaît dans la section "Mes jokers".
      return `/app/concours/${n.payload.concours_id}`;
  }
};

// ------------------------------------------------------------------
//  COMPOSANT
// ------------------------------------------------------------------

type NotificationItemProps = {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  /** Fermée après navigation par le parent (pop-up cloche). */
  onNavigate?: () => void;
};

export const NotificationItem = ({
  notification,
  onMarkAsRead,
  onNavigate,
}: NotificationItemProps) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const isUnread = notification.read_at === null;
  const visual = TYPE_VISUALS[notification.type] ?? {
    icon: BellIcon,
    iconClassName: 'text-muted-foreground',
    bgClassName: 'bg-muted',
  };
  const Icon = visual.icon;

  const title = resolveTitle(notification, t);
  const body = resolveBody(notification, t);
  const relative = formatRelative(notification.created_at, i18n.language, t);

  const handleClick = () => {
    if (isUnread) onMarkAsRead(notification.id);
    onNavigate?.();
    navigate(resolveRoute(notification));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent focus:bg-accent focus:outline-none',
        isUnread && 'bg-primary/5',
      )}
      data-unread={isUnread}
      aria-label={t('notifications.item.ariaLabel', {
        title,
        time: relative,
      })}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          visual.bgClassName,
        )}
        aria-hidden
      >
        <Icon className={cn('h-4 w-4', visual.iconClassName)} />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {title}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {relative}
          </span>
        </span>
        <span className="line-clamp-2 text-sm text-muted-foreground">
          {body}
        </span>
      </span>

      {isUnread ? (
        <span
          className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary"
          aria-label={t('notifications.item.unreadDot')}
        />
      ) : null}
    </button>
  );
};
