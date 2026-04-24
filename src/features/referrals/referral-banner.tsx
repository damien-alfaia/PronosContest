import { Check, Copy, Gift, Share2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

import { buildReferralUrl } from './api';
import { useMyReferralsCountQuery } from './use-referrals';

/**
 * ReferralBanner — Sprint 9.C.3 (viral loop).
 *
 * Bandeau affiché sur la fiche d'un concours ET post-création, qui
 * pousse l'ambassadeur à partager son code. 3 éléments :
 *
 *   1. Code d'invitation bien visible + bouton "Copier".
 *   2. Bouton "Partager" (Web Share API si dispo sur l'appareil,
 *      sinon copie du lien complet en fallback).
 *   3. Progression vers le prochain milestone joker : "X / 3 potes
 *      rejoints — 1 joker au suivant 🎁".
 *
 * La récompense est gérée par le trigger SQL `handle_referral_milestone`
 * (migration `20260503120000_referrals.sql`) : tous les 3 invités qui
 * rejoignent, l'ambassadeur reçoit 1 joker `double` + une notification
 * `referral_milestone`.
 *
 * Accessibilité :
 *   - CTAs avec label visible + `aria-label` explicite sur les boutons
 *     uniquement icône.
 *   - Feedback visuel "copié" avec aria-live.
 *   - Respect `prefers-reduced-motion` (pas d'animation critique).
 */

export interface ReferralBannerProps {
  concoursId: string;
  concoursName: string;
  codeInvitation: string;
  className?: string;
  /**
   * Rend un visuel plus compact sans titre/description (pour la post-
   * création où le bandeau est inline dans une toast ou un wrapper).
   */
  compact?: boolean;
}

const MILESTONE_EVERY = 3;

export function ReferralBanner({
  concoursId,
  concoursName,
  codeInvitation,
  className,
  compact = false,
}: ReferralBannerProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id;

  const countQuery = useMyReferralsCountQuery(userId);
  const invitesCount = countQuery.data ?? 0;
  const toNext = MILESTONE_EVERY - (invitesCount % MILESTONE_EVERY);
  const progressPct = ((invitesCount % MILESTONE_EVERY) / MILESTONE_EVERY) * 100;

  const referralUrl = userId
    ? buildReferralUrl(codeInvitation, userId)
    : '';

  const [justCopied, setJustCopied] = useState<'code' | 'link' | null>(null);

  const copyText = async (text: string, kind: 'code' | 'link') => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback legacy (vieux Safari, iOS sans HTTPS) : selection + execCommand.
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setJustCopied(kind);
      toast.success(
        kind === 'code'
          ? t('referrals.banner.toast.codeCopied')
          : t('referrals.banner.toast.linkCopied'),
      );
      window.setTimeout(() => setJustCopied(null), 2_000);
    } catch {
      toast.error(t('referrals.banner.toast.copyError'));
    }
  };

  const handleShare = async () => {
    if (!userId) return;

    const shareData = {
      title: t('referrals.banner.share.title'),
      text: t('referrals.banner.share.text', { concours: concoursName }),
      url: referralUrl,
    };

    // Web Share API (natif mobile + quelques desktops)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        // Pas de toast ici : le navigateur affiche sa propre UI de
        // confirmation. L'erreur AbortError (user a annulé) est muette.
        return;
      } catch (err) {
        // AbortError = user a annulé la share sheet, normal.
        if (err instanceof Error && err.name === 'AbortError') return;
        // Sinon on retombe sur le copy fallback.
      }
    }

    // Fallback : copie du lien complet
    await copyText(referralUrl, 'link');
  };

  const atMilestone = invitesCount > 0 && invitesCount % MILESTONE_EVERY === 0;

  return (
    <Card
      className={cn(
        'border-primary/30 bg-brand-gradient-soft',
        compact && 'py-3',
        className,
      )}
      data-concours-id={concoursId}
    >
      {!compact ? (
        <CardHeader className="flex-row items-start gap-3 space-y-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-primary">
            <Share2 className="h-5 w-5" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">
              {t('referrals.banner.title')}
            </CardTitle>
            <CardDescription>
              {t('referrals.banner.description')}
            </CardDescription>
          </div>
        </CardHeader>
      ) : null}

      <CardContent className={cn('flex flex-col gap-4', compact && 'pt-0')}>
        {/* Code d'invitation — gros, tappable, copiable */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor={`referral-code-${concoursId}`}
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            {t('referrals.banner.codeLabel')}
          </label>
          <div className="flex items-stretch gap-2">
            <input
              id={`referral-code-${concoursId}`}
              readOnly
              value={codeInvitation}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-center font-mono text-base font-semibold tracking-widest shadow-xs"
              aria-label={t('referrals.banner.codeLabel')}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void copyText(codeInvitation, 'code')}
              aria-label={t('referrals.banner.toast.codeCopied')}
              className="shrink-0"
            >
              {justCopied === 'code' ? (
                <Check className="h-4 w-4 text-success" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
            </Button>
          </div>
        </div>

        {/* Partage natif */}
        <Button type="button" onClick={() => void handleShare()} size="lg">
          <Share2 className="mr-2 h-4 w-4" aria-hidden />
          {t('referrals.banner.shareCta')}
        </Button>

        {/* Progression vers milestone */}
        <div
          className="flex flex-col gap-2 rounded-md border border-primary/20 bg-background/70 p-3"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-sm">
            <Gift className="h-4 w-4 text-accent" aria-hidden />
            <span className="font-medium">
              {atMilestone
                ? t('referrals.banner.milestone.reached', {
                    count: invitesCount,
                  })
                : t('referrals.banner.milestone.progress', {
                    current: invitesCount % MILESTONE_EVERY,
                    total: MILESTONE_EVERY,
                    toNext,
                  })}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={MILESTONE_EVERY}
            aria-valuenow={invitesCount % MILESTONE_EVERY}
            className="h-1.5 w-full overflow-hidden rounded-full bg-primary/10"
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-slow ease-celebration"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t('referrals.banner.milestone.hint')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
