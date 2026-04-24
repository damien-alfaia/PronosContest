import { ArrowUp, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyStateIllustrated } from '@/components/common/empty-state-illustrated';
import { Button } from '@/components/ui/button';

import { MessageBubble } from './message-bubble';
import { type MessageWithAuthor } from './schemas';

/**
 * Liste de messages avec :
 *   - Groupage par jour (séparateur "Aujourd'hui / Hier / 12 avr. 2026")
 *   - Groupage par rafale du même auteur (les messages consécutifs d'un
 *     même user n'affichent le header qu'une seule fois)
 *   - Bouton "Charger plus ancien" en haut (désactivé si pas de page
 *     suivante, spinner pendant le fetch)
 *   - Auto-scroll vers le bas quand :
 *       a) le composant monte ;
 *       b) un nouveau message arrive ET l'utilisateur est déjà collé
 *          au bas (sinon on ne perturbe pas sa lecture d'un backlog).
 *
 * Ce composant est "bête" : il reçoit la liste déjà aplatie en ordre
 * ASC (plus ancien → plus récent) et des callbacks pour la pagination.
 * La logique TanStack Query vit dans `ConcoursChatPage`.
 */

type Props = {
  messages: MessageWithAuthor[];
  selfUserId: string | undefined;
  /** L'infinite query a encore des pages plus anciennes ? */
  hasNextPage: boolean;
  /** Fetch en cours sur la prochaine page ? */
  isFetchingNextPage: boolean;
  /** Initial load ? (avant que pages[0] ne soit arrivée) */
  isInitialLoading: boolean;
  /** Callback du bouton "Charger plus ancien". */
  onLoadOlder: () => void;
};

// ------------------------------------------------------------------
//  GROUPING : par jour + par rafale
// ------------------------------------------------------------------

type DayGroup = {
  dayKey: string; // ISO date (YYYY-MM-DD)
  messages: MessageWithAuthor[];
};

const dayKeyOf = (iso: string): string => {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const groupByDay = (messages: MessageWithAuthor[]): DayGroup[] => {
  const out: DayGroup[] = [];
  let current: DayGroup | null = null;
  for (const m of messages) {
    const k = dayKeyOf(m.created_at);
    if (!current || current.dayKey !== k) {
      current = { dayKey: k, messages: [m] };
      out.push(current);
    } else {
      current.messages.push(m);
    }
  }
  return out;
};

const formatDayLabel = (
  dayKey: string,
  locale: string,
  t: (k: string) => string,
): string => {
  const today = dayKeyOf(new Date().toISOString());
  const yesterday = dayKeyOf(
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  );

  if (dayKey === today) return t('chat.days.today');
  if (dayKey === yesterday) return t('chat.days.yesterday');

  try {
    const d = new Date(dayKey);
    return d.toLocaleDateString(locale === 'en' ? 'en-GB' : 'fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dayKey;
  }
};

// ------------------------------------------------------------------
//  COMPONENT
// ------------------------------------------------------------------

export const MessageList = ({
  messages,
  selfUserId,
  hasNextPage,
  isFetchingNextPage,
  isInitialLoading,
  onLoadOlder,
}: Props) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.split('-')[0] ?? 'fr';

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const wasAtBottomRef = useRef(true);
  const previousCountRef = useRef(0);

  const dayGroups = useMemo(() => groupByDay(messages), [messages]);

  // ---- Auto-scroll vers le bas ----
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const count = messages.length;
    const prev = previousCountRef.current;
    previousCountRef.current = count;

    // 1er render avec des messages → scroll direct en bas
    if (prev === 0 && count > 0) {
      el.scrollTop = el.scrollHeight;
      return;
    }

    // Ajout de messages : scroll seulement si on était déjà en bas
    if (count > prev && wasAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  // ---- Détection "l'user est en bas" (pour décider de l'auto-scroll) ----
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    // Marge de 40 px pour considérer qu'on est "en bas".
    const threshold = 40;
    wasAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  // ---- Rendu ----

  if (isInitialLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Loader2
          className="h-5 w-5 animate-spin text-muted-foreground"
          aria-hidden
        />
        <span className="ml-2 text-sm text-muted-foreground">
          {t('chat.loading')}
        </span>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyStateIllustrated
          illustration="chat"
          size="sm"
          title={t('chat.empty.title')}
          description={t('chat.empty.description')}
          className="border-none"
        />
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3"
      aria-live="polite"
      aria-relevant="additions"
    >
      {/* Bouton "Charger plus ancien" en haut */}
      <div className="flex justify-center pb-1">
        {hasNextPage ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLoadOlder}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ArrowUp className="mr-2 h-4 w-4" aria-hidden />
            )}
            {t('chat.loadOlder')}
          </Button>
        ) : messages.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {t('chat.noMoreMessages')}
          </span>
        ) : null}
      </div>

      {/* Groupes jour */}
      {dayGroups.map((group) => (
        <div key={group.dayKey} className="flex flex-col gap-2">
          <div className="sticky top-0 z-10 flex justify-center">
            <span className="rounded-full bg-muted px-3 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm">
              {formatDayLabel(group.dayKey, locale, t)}
            </span>
          </div>

          {/* Messages du jour, avec groupage par rafale */}
          <ul className="flex flex-col gap-1">
            {group.messages.map((m, idx) => {
              const prev = group.messages[idx - 1];
              const sameAuthor = prev ? prev.user_id === m.user_id : false;
              // Seuil : 5 min entre deux messages pour qu'ils restent
              // groupés (sinon on ré-affiche le header).
              const withinBurst = prev
                ? new Date(m.created_at).getTime() -
                    new Date(prev.created_at).getTime() <
                  5 * 60_000
                : false;
              const showHeader = !(sameAuthor && withinBurst);
              return (
                <li key={m.id} className="list-none">
                  <MessageBubble
                    message={m}
                    isSelf={selfUserId === m.user_id}
                    showHeader={showHeader}
                    locale={locale}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
};
