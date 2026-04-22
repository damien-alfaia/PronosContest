import { ArrowLeft, MessageSquare, Target, Trophy } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { FullScreenSpinner } from '@/components/common/full-screen-spinner';
import { Button } from '@/components/ui/button';
import { useConcoursDetailQuery } from '@/features/concours/use-concours';
import { useAuth } from '@/hooks/use-auth';

import { MessageComposer } from './message-composer';
import { MessageList } from './message-list';
import {
  flattenMessagesAsc,
  useChatRealtime,
  useMessagesInfiniteQuery,
  useSendMessageMutation,
} from './use-chat';

/**
 * Page Chat d'un concours.
 *
 * Route : `/app/concours/:id/chat`
 *
 * Accès :
 *   - Membre du concours : OK.
 *   - Sinon : redirect vers la fiche concours (où il pourra rejoindre).
 *
 * Fonctionnement :
 *   - `useMessagesInfiniteQuery` charge les pages (50 messages) en
 *     remontant le temps. `useChatRealtime` prepend les nouveaux messages.
 *   - `flattenMessagesAsc` aplatit + inverse les pages pour un affichage
 *     ASC (plus ancien en haut, plus récent en bas).
 *   - Erreurs d'envoi : toast, et le texte reste dans le composer pour
 *     que l'user puisse réessayer.
 *
 * Layout :
 *   - Full-height sous le shell AppLayout : on utilise `max-h` + `flex`
 *     pour que la liste scrolle indépendamment et que le composer reste
 *     visible en bas (sticky).
 */

export const ConcoursChatPage = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const userId = user?.id;

  const detailQuery = useConcoursDetailQuery(id);
  const concours = detailQuery.data;

  const isMember = useMemo(
    () =>
      Boolean(
        concours &&
          userId &&
          concours.participants.some((p) => p.user_id === userId),
      ),
    [concours, userId],
  );

  const messagesQuery = useMessagesInfiniteQuery(isMember ? id : undefined);
  useChatRealtime(isMember ? id : undefined, { enabled: isMember });

  const sendMutation = useSendMessageMutation(
    isMember ? id : undefined,
    userId,
  );

  const flatMessages = useMemo(
    () => flattenMessagesAsc(messagesQuery.data),
    [messagesQuery.data],
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

  // ---------- Handlers ----------

  const handleSend = async (body: string) => {
    await sendMutation.mutateAsync(body).catch((err: unknown) => {
      // Mapping d'erreurs RLS / FK / CHECK. En pratique, avec un user
      // membre qui tape un message valide, on ne devrait jamais tomber
      // ici — mais on protège quand même.
      const code =
        err && typeof err === 'object' && 'code' in err
          ? (err as { code?: string }).code
          : undefined;
      if (code === '42501') {
        toast.error(t('chat.errors.forbidden'));
      } else {
        toast.error(t('chat.errors.sendFailed'));
      }
      throw err; // Propage pour que le composer garde le texte.
    });
  };

  // ---------- Rendu ----------

  return (
    <section className="flex h-[calc(100vh-9rem)] min-h-[32rem] flex-col gap-3 md:h-[calc(100vh-7rem)]">
      {/* En-tête compact */}
      <div className="flex flex-col gap-2">
        <Button asChild variant="ghost" size="sm" className="self-start px-2">
          <Link to={`/app/concours/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            {t('chat.backToConcours')}
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <MessageSquare
                className="h-6 w-6 text-primary"
                aria-hidden
              />
              {t('chat.title')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {concours.nom} · {concours.competition?.nom ?? '—'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={`/app/concours/${id}/pronos`}>
                <Target className="mr-2 h-4 w-4" aria-hidden />
                {t('chat.goToPronos')}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/app/concours/${id}/classement`}>
                <Trophy className="mr-2 h-4 w-4" aria-hidden />
                {t('chat.goToClassement')}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Zone chat : liste scrollable + composer sticky */}
      <div className="flex min-h-0 flex-1 flex-col rounded-md border bg-card">
        {messagesQuery.isError ? (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-destructive">
            {t('chat.errors.loadFailed')}
          </div>
        ) : (
          <MessageList
            messages={flatMessages}
            selfUserId={userId}
            hasNextPage={Boolean(messagesQuery.hasNextPage)}
            isFetchingNextPage={messagesQuery.isFetchingNextPage}
            isInitialLoading={
              messagesQuery.isLoading && flatMessages.length === 0
            }
            onLoadOlder={() => void messagesQuery.fetchNextPage()}
          />
        )}

        <MessageComposer
          onSend={handleSend}
          isSending={sendMutation.isPending}
          disabled={!isMember}
          autoFocus
        />
      </div>
    </section>
  );
};
