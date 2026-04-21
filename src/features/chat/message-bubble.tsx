import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

import {
  type MessageWithAuthor,
  formatAuthorName,
  pickAuthorInitials,
} from './schemas';

/**
 * Bulle de message "Slack-like".
 *
 * Deux variantes :
 *   - `isSelf` : alignée à droite, fond primary (reconnaissance immédiate).
 *   - autrui : alignée à gauche, fond muted.
 *
 * Le header (nom + heure) est affiché uniquement pour le 1er message
 * d'une "rafale" du même auteur (propre `showHeader`). Les messages
 * consécutifs d'un même auteur sont groupés visuellement.
 *
 * Accessibilité :
 *   - `<article>` + `aria-label` avec auteur + heure lisible.
 *   - L'avatar porte `alt=""` (décoration ; le nom est à côté).
 */

type Props = {
  /** Message normalisé (avec ou sans auteur joint). */
  message: MessageWithAuthor;
  /** Message envoyé par l'utilisateur courant ? */
  isSelf: boolean;
  /** Afficher le header (avatar + nom + heure) ? */
  showHeader: boolean;
  /** Locale pour le formatage de l'heure (fr/en). */
  locale?: string;
};

const formatTime = (iso: string, locale: string): string => {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(locale === 'en' ? 'en-GB' : 'fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

export const MessageBubble = ({
  message,
  isSelf,
  showHeader,
  locale = 'fr',
}: Props) => {
  const authorName = formatAuthorName(message.author);
  const initials = pickAuthorInitials(message.author);
  const time = formatTime(message.created_at, locale);
  const isOptimistic = message.id.startsWith('optimistic-');

  return (
    <article
      className={cn(
        'flex w-full gap-2',
        isSelf ? 'flex-row-reverse' : 'flex-row',
      )}
      aria-label={`${authorName} · ${time}`}
    >
      {/* Avatar : affiché uniquement sur la première bulle d'une rafale.
          On garde l'espace (w-8) pour les bulles suivantes afin d'aligner
          visuellement les messages groupés. */}
      <div className="flex w-8 shrink-0 justify-center">
        {showHeader ? (
          <Avatar className="h-8 w-8">
            {message.author?.avatar_url ? (
              <AvatarImage
                src={message.author.avatar_url}
                alt=""
                aria-hidden
              />
            ) : null}
            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>
        ) : null}
      </div>

      <div
        className={cn(
          'flex max-w-[75%] flex-col gap-1',
          isSelf ? 'items-end' : 'items-start',
        )}
      >
        {showHeader ? (
          <div
            className={cn(
              'flex items-baseline gap-2 text-xs',
              isSelf ? 'flex-row-reverse' : 'flex-row',
            )}
          >
            <span className="font-medium text-foreground">{authorName}</span>
            <span className="text-muted-foreground">{time}</span>
          </div>
        ) : null}

        <div
          className={cn(
            'rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words',
            isSelf
              ? 'rounded-tr-sm bg-primary text-primary-foreground'
              : 'rounded-tl-sm bg-muted text-foreground',
            isOptimistic && 'opacity-70',
          )}
          // `title` sert de tooltip heure pour les bulles groupées
          // (sans header), inspiré de Slack/Discord.
          title={!showHeader ? time : undefined}
        >
          {message.body}
        </div>
      </div>
    </article>
  );
};
