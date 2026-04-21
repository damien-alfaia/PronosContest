import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Send } from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import {
  MESSAGE_BODY_MAX,
  type SendMessageInput,
  sendMessageSchema,
} from './schemas';

/**
 * Formulaire d'envoi d'un message (Textarea + bouton Send).
 *
 * - Zod + React Hook Form : validation côté client, erreurs
 *   traduites via les clés `chat.errors.*`.
 * - `Ctrl+Enter` (ou `Cmd+Enter` sur macOS) envoie sans quitter le
 *   champ. `Enter` seul insère un retour à la ligne (convention Slack).
 * - Auto-resize : le Textarea grandit jusqu'à ~6 lignes puis scroll
 *   interne. On reset à la hauteur mini après un envoi.
 * - Compteur de caractères visible dès 80 % de la limite, rouge au-delà.
 * - `disabled` pendant l'envoi pour éviter les doubles submits.
 */

type Props = {
  /** Appelé avec le `body` validé. Retourne une promesse pour pouvoir
   *  reset le champ uniquement en cas de succès serveur. */
  onSend: (body: string) => Promise<void>;
  /** Envoi en cours (désactive le bouton + le textarea). */
  isSending: boolean;
  /** Désactive complètement le composer (ex. non-membre). */
  disabled?: boolean;
  /** Focus auto au montage (page chat dédiée). */
  autoFocus?: boolean;
};

const MIN_HEIGHT_PX = 40;
const MAX_HEIGHT_PX = 160; // ~ 6 lignes

export const MessageComposer = ({
  onSend,
  isSending,
  disabled = false,
  autoFocus = false,
}: Props) => {
  const { t } = useTranslation();

  const form = useForm<SendMessageInput>({
    resolver: zodResolver(sendMessageSchema),
    defaultValues: { body: '' },
    mode: 'onChange',
  });

  const { register, handleSubmit, formState, watch, reset, setFocus } = form;
  const body = watch('body') ?? '';
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ---- Auto-resize ----
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(
      Math.max(el.scrollHeight, MIN_HEIGHT_PX),
      MAX_HEIGHT_PX,
    );
    el.style.height = `${next}px`;
  }, [body]);

  useEffect(() => {
    if (autoFocus) setFocus('body');
  }, [autoFocus, setFocus]);

  const { ref: bodyRef, ...bodyRest } = register('body');

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter ou Cmd+Enter → submit
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleSubmit(onValid)();
    }
  };

  const onValid = async (values: SendMessageInput) => {
    try {
      await onSend(values.body);
      reset({ body: '' });
      // Remet le textarea à la hauteur mini (sinon il garde la hauteur
      // du long message qui vient d'être envoyé).
      const el = textareaRef.current;
      if (el) el.style.height = `${MIN_HEIGHT_PX}px`;
    } catch {
      // L'erreur est affichée par le parent via un toast — on garde le
      // texte dans le champ pour que l'user puisse réessayer.
    }
  };

  const remaining = MESSAGE_BODY_MAX - body.trim().length;
  const showCounter = body.length > MESSAGE_BODY_MAX * 0.8;
  const isOverLimit = remaining < 0;
  const errorKey = formState.errors.body?.message;
  // React Hook Form stocke notre clé i18n directement dans `message`.
  const errorLabel = errorKey ? t(errorKey) : null;

  const isDisabled = disabled || isSending;
  const canSubmit =
    !isDisabled && body.trim().length > 0 && !isOverLimit && formState.isValid;

  return (
    <form
      onSubmit={handleSubmit(onValid)}
      className="flex flex-col gap-1.5 border-t bg-background p-3"
      aria-label={t('chat.composer.ariaLabel')}
    >
      <div className="flex items-end gap-2">
        <Textarea
          {...bodyRest}
          ref={(el) => {
            bodyRef(el);
            textareaRef.current = el;
          }}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={
            disabled
              ? t('chat.composer.placeholderDisabled')
              : t('chat.composer.placeholder')
          }
          disabled={isDisabled}
          maxLength={MESSAGE_BODY_MAX + 200 /* garde 200 cr de marge pour le trim */}
          className="min-h-[40px] resize-none"
          style={{ height: MIN_HEIGHT_PX }}
          aria-label={t('chat.composer.ariaLabel')}
          aria-invalid={Boolean(errorLabel) || isOverLimit}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!canSubmit}
          aria-label={t('chat.composer.send')}
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </div>

      <div className="flex min-h-4 items-center justify-between text-xs">
        <div>
          {errorLabel ? (
            <span className="text-destructive" role="alert">
              {errorLabel}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {t('chat.composer.hint')}
            </span>
          )}
        </div>
        {showCounter ? (
          <span
            className={cn(
              'tabular-nums',
              isOverLimit ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {remaining}
          </span>
        ) : null}
      </div>
    </form>
  );
};
