import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useMatchsQuery } from '@/features/pronos/use-pronos';
import { cn } from '@/lib/utils';

import {
  JOKER_CONSUMPTION_ERROR_CODES,
  type ConsumeJokerArgs,
  type JokerConsumptionErrorCode,
} from './api';
import { resolveJokerIcon } from './joker-icon';
import {
  compareJokerCatalog,
  pickLocalized,
  type UserJokerWithCatalog,
} from './schemas';
import {
  useConcoursParticipantsForPickerQuery,
  useConsumeJokerMutation,
  useUserJokersInConcoursQuery,
} from './use-jokers';

type Props = {
  /** Slot sélectionné. `null` → dialog non monté (garde côté appelant). */
  userJoker: UserJokerWithCatalog | null;
  /** UUID du concours (utile pour les pickers + `competition_id`). */
  concoursId: string;
  /** UUID de la compétition parent (pour la liste des matchs cibles). */
  competitionId: string | undefined;
  /** UUID du caller (pour exclure self des pickers user). */
  currentUserId: string | undefined;
  /** Ouverture du dialog. */
  open: boolean;
  /** Callback de fermeture (annulation ou succès). */
  onOpenChange: (open: boolean) => void;
};

/**
 * Mappe le `joker_code` à la combinaison d'inputs à afficher. Doit
 * rester aligné avec les règles du RPC `use_joker` (migration 8.B.1) :
 *
 *   ┌──────────────┬───────┬──────┬────────────┐
 *   │ code         │ match │ user │ payload    │
 *   ├──────────────┼───────┼──────┼────────────┤
 *   │ double       │   ✔  │  ✘  │ ✘          │
 *   │ triple       │   ✔  │  ✘  │ ✘          │
 *   │ safety_net   │   ✔  │  ✘  │ ✘          │
 *   │ boussole     │   ✔  │  ✘  │ auto (SQL)│
 *   │ challenge    │   ✔  │  ✔  │ auto       │
 *   │ double_down  │   ✔  │  ✔  │ auto       │
 *   │ gift         │   ✘  │  ✔  │ gifted_code│
 *   └──────────────┴───────┴──────┴────────────┘
 *
 * Tout joker inconnu : le dialog affiche une erreur et bloque le submit.
 */
type JokerUX = {
  needsMatch: boolean;
  needsUser: boolean;
  needsGiftedCode: boolean;
};

const resolveJokerUX = (code: string): JokerUX => {
  if (code === 'double' || code === 'triple' || code === 'safety_net') {
    return { needsMatch: true, needsUser: false, needsGiftedCode: false };
  }
  if (code === 'boussole') {
    return { needsMatch: true, needsUser: false, needsGiftedCode: false };
  }
  if (code === 'challenge' || code === 'double_down') {
    return { needsMatch: true, needsUser: true, needsGiftedCode: false };
  }
  if (code === 'gift') {
    return { needsMatch: false, needsUser: true, needsGiftedCode: true };
  }
  return { needsMatch: false, needsUser: false, needsGiftedCode: false };
};

/**
 * Codes triés par longueur décroissante : certains codes contiennent
 * des sous-chaînes d'autres (ex : `category_already_used_on_match`
 * inclut `already_used`). On fait correspondre les plus longs d'abord
 * pour éviter les faux positifs sur `.includes()`.
 */
const SORTED_ERROR_CODES: readonly JokerConsumptionErrorCode[] = [
  ...JOKER_CONSUMPTION_ERROR_CODES,
].sort((a, b) => b.length - a.length);

/**
 * Extrait un code d'erreur connu depuis le message remonté par la RPC.
 * PostgREST renvoie en général `Error` avec `.message` contenant la
 * chaîne `raise exception '<code>'` côté SQL. On cherche une sous-chaîne
 * pour rester robuste aux variations de format, mais on privilégie un
 * match exact quand le `.message` est exactement un code — ce qui est
 * le cas le plus courant.
 */
const extractErrorCode = (err: unknown): JokerConsumptionErrorCode | null => {
  if (!err) return null;
  const msg =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : String((err as { message?: unknown })?.message ?? '');
  const trimmed = msg.trim();
  // 1) Match exact en priorité (le cas nominal : `raise exception '<code>'`).
  for (const code of JOKER_CONSUMPTION_ERROR_CODES) {
    if (trimmed === code) return code;
  }
  // 2) Fallback `includes`, codes les plus longs d'abord pour éviter les
  //    faux positifs (ex : `already_used` ⊂ `category_already_used_on_match`).
  for (const code of SORTED_ERROR_CODES) {
    if (msg.includes(code)) return code;
  }
  return null;
};

const displayName = (prenom: string | null, nom: string | null): string => {
  const p = prenom?.trim() ?? '';
  const n = nom?.trim() ?? '';
  if (p && n) return `${p} ${n}`;
  if (p) return p;
  if (n) return n;
  return '—';
};

/**
 * Dialog de consommation d'un joker. Pré-scopé à un slot précis —
 * le caller sélectionne le joker (via click sur une tuile owned), le
 * dialog demande uniquement les cibles nécessaires au `joker_code`.
 *
 * UX :
 *   - overlay fullscreen (même pattern que `MatchResultDialog`),
 *   - focus initial sur le premier Select/bouton de la section,
 *   - Escape et click sur l'overlay ferment le dialog,
 *   - Submit désactivé tant que les champs obligatoires ne sont pas
 *     remplis (client-side guard avant la RPC).
 *
 * Les erreurs remontées par la RPC sont mappées vers des libellés
 * i18n `jokers.consume.errors.<code>` ; un fallback générique est
 * utilisé si le code n'est pas reconnu.
 */
export const ConsumeJokerDialog = ({
  userJoker,
  concoursId,
  competitionId,
  currentUserId,
  open,
  onOpenChange,
}: Props) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('en') ? 'en' : 'fr';

  const firstFieldRef = useRef<HTMLSelectElement | null>(null);

  const [matchId, setMatchId] = useState<string>('');
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [giftedCode, setGiftedCode] = useState<string>('');

  // Code en cours : vide si pas de slot → UX neutre.
  const code = userJoker?.joker_code ?? '';
  const ux = useMemo(() => resolveJokerUX(code), [code]);

  // Data pickers : on n'appelle les queries que si le dialog est ouvert
  // ET que la donnée est nécessaire au joker courant, pour ne pas
  // solliciter le backend inutilement.
  const matchsQuery = useMatchsQuery(
    open && ux.needsMatch ? competitionId : undefined,
  );
  const participantsQuery = useConcoursParticipantsForPickerQuery(
    open && ux.needsUser ? concoursId : undefined,
  );
  // Les jokers owned du caller (pour le picker gifted_code).
  const myJokersQuery = useUserJokersInConcoursQuery(
    open && ux.needsGiftedCode ? currentUserId : undefined,
    open && ux.needsGiftedCode ? concoursId : undefined,
  );

  const mutation = useConsumeJokerMutation();

  // Reset des champs à chaque ouverture ou changement de slot, +
  // autofocus du 1er select.
  useEffect(() => {
    if (!open) return;
    setMatchId('');
    setTargetUserId('');
    setGiftedCode('');
    const id = window.setTimeout(() => firstFieldRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open, userJoker?.id]);

  // Escape pour fermer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  // Filtrage des matchs : exclure ceux déjà verrouillés (kick-off passé).
  const availableMatchs = useMemo(() => {
    const now = Date.now();
    return (matchsQuery.data ?? []).filter((m) => {
      const ts = m.kick_off_at ? new Date(m.kick_off_at).getTime() : Infinity;
      return ts > now;
    });
  }, [matchsQuery.data]);

  // Participants filtrés : exclure soi-même pour challenge / gift.
  const availableParticipants = useMemo(() => {
    return (participantsQuery.data ?? []).filter(
      (p) => p.user_id !== currentUserId,
    );
  }, [participantsQuery.data, currentUserId]);

  // Jokers offrables : possédés (owned), hors le slot gift courant,
  // hors autres slots `gift` (un gift ne peut pas être offert).
  const giftableJokers = useMemo(() => {
    const all = myJokersQuery.data ?? [];
    const seenCodes = new Set<string>();
    const result: UserJokerWithCatalog[] = [];
    for (const uj of all) {
      if (uj.used_at !== null) continue;
      if (uj.id === userJoker?.id) continue;
      if (uj.joker_code === 'gift') continue;
      if (seenCodes.has(uj.joker_code)) continue;
      seenCodes.add(uj.joker_code);
      result.push(uj);
    }
    // Tri catalogue (category rank → sort_order → code).
    return result.sort((a, b) => compareJokerCatalog(a.joker, b.joker));
  }, [myJokersQuery.data, userJoker?.id]);

  // Valide le formulaire côté client (garde avant la RPC).
  const canSubmit =
    Boolean(userJoker) &&
    (!ux.needsMatch || matchId !== '') &&
    (!ux.needsUser || targetUserId !== '') &&
    (!ux.needsGiftedCode || giftedCode !== '') &&
    !mutation.isPending;

  if (!open || !userJoker) return null;

  const libelle = pickLocalized(userJoker.joker.libelle, lang);
  const description = pickLocalized(userJoker.joker.description, lang);
  const Icon = resolveJokerIcon(userJoker.joker.icon);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;

    const args: ConsumeJokerArgs = {
      userJokerId: userJoker.id,
      targetMatchId: ux.needsMatch ? matchId : null,
      targetUserId: ux.needsUser ? targetUserId : null,
      payload: ux.needsGiftedCode ? { gifted_joker_code: giftedCode } : null,
    };

    mutation.mutate(args, {
      onSuccess: () => {
        toast.success(t('jokers.consume.toast.success', { joker: libelle }));
        onOpenChange(false);
      },
      onError: (err) => {
        const code = extractErrorCode(err);
        const errorKey = code
          ? `jokers.consume.errors.${code}`
          : 'jokers.consume.errors.generic';
        toast.error(t(errorKey));
      },
    });
  };

  const isUnknownCode = !ux.needsMatch && !ux.needsUser && !ux.needsGiftedCode;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consume-joker-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-xl">
        <header className="mb-4 flex items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 flex-none items-center justify-center rounded-full',
              'bg-primary/10 text-primary',
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div className="flex flex-1 flex-col">
            <h2 id="consume-joker-title" className="text-lg font-semibold">
              {t('jokers.consume.title', { joker: libelle })}
            </h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </header>

        {isUnknownCode ? (
          <p className="text-sm text-destructive">
            {t('jokers.consume.errors.unknown_joker_code')}
          </p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            {/* Picker Match */}
            {ux.needsMatch ? (
              <div className="flex flex-col gap-1">
                <Label htmlFor="consume-match">
                  {t('jokers.consume.fields.match')}
                </Label>
                <select
                  id="consume-match"
                  ref={firstFieldRef}
                  value={matchId}
                  onChange={(e) => setMatchId(e.target.value)}
                  disabled={matchsQuery.isLoading || mutation.isPending}
                  className={cn(
                    'h-10 rounded-md border border-input bg-background px-3 text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-ring',
                  )}
                  aria-invalid={matchId === '' ? true : undefined}
                >
                  <option value="" disabled>
                    {matchsQuery.isLoading
                      ? t('common.loading')
                      : t('jokers.consume.fields.matchPlaceholder')}
                  </option>
                  {availableMatchs.map((m) => {
                    const a = m.equipe_a?.nom ?? '—';
                    const b = m.equipe_b?.nom ?? '—';
                    const date = m.kick_off_at
                      ? new Date(m.kick_off_at).toLocaleDateString(lang, {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '';
                    return (
                      <option key={m.id} value={m.id}>
                        {date ? `${date} · ` : ''}
                        {a} – {b}
                      </option>
                    );
                  })}
                </select>
                {matchsQuery.isError ? (
                  <p className="text-xs text-destructive">
                    {t('jokers.consume.fields.matchError')}
                  </p>
                ) : availableMatchs.length === 0 && !matchsQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">
                    {t('jokers.consume.fields.matchEmpty')}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* Picker User */}
            {ux.needsUser ? (
              <div className="flex flex-col gap-1">
                <Label htmlFor="consume-user">
                  {t('jokers.consume.fields.user')}
                </Label>
                <select
                  id="consume-user"
                  ref={ux.needsMatch ? undefined : firstFieldRef}
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  disabled={participantsQuery.isLoading || mutation.isPending}
                  className={cn(
                    'h-10 rounded-md border border-input bg-background px-3 text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-ring',
                  )}
                  aria-invalid={targetUserId === '' ? true : undefined}
                >
                  <option value="" disabled>
                    {participantsQuery.isLoading
                      ? t('common.loading')
                      : t('jokers.consume.fields.userPlaceholder')}
                  </option>
                  {availableParticipants.map((p) => (
                    <option key={p.user_id} value={p.user_id}>
                      {displayName(p.prenom, p.nom)}
                    </option>
                  ))}
                </select>
                {participantsQuery.isError ? (
                  <p className="text-xs text-destructive">
                    {t('jokers.consume.fields.userError')}
                  </p>
                ) : availableParticipants.length === 0 &&
                  !participantsQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">
                    {t('jokers.consume.fields.userEmpty')}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* Picker Gifted joker code */}
            {ux.needsGiftedCode ? (
              <div className="flex flex-col gap-1">
                <Label htmlFor="consume-gifted">
                  {t('jokers.consume.fields.giftedJoker')}
                </Label>
                <select
                  id="consume-gifted"
                  value={giftedCode}
                  onChange={(e) => setGiftedCode(e.target.value)}
                  disabled={myJokersQuery.isLoading || mutation.isPending}
                  className={cn(
                    'h-10 rounded-md border border-input bg-background px-3 text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-ring',
                  )}
                  aria-invalid={giftedCode === '' ? true : undefined}
                >
                  <option value="" disabled>
                    {myJokersQuery.isLoading
                      ? t('common.loading')
                      : t('jokers.consume.fields.giftedJokerPlaceholder')}
                  </option>
                  {giftableJokers.map((uj) => (
                    <option key={uj.joker_code} value={uj.joker_code}>
                      {pickLocalized(uj.joker.libelle, lang)}
                    </option>
                  ))}
                </select>
                {myJokersQuery.isError ? (
                  <p className="text-xs text-destructive">
                    {t('jokers.consume.fields.giftedJokerError')}
                  </p>
                ) : giftableJokers.length === 0 && !myJokersQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">
                    {t('jokers.consume.fields.giftedJokerEmpty')}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {mutation.isPending ? (
                  <>
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden
                    />
                    {t('jokers.consume.submitting')}
                  </>
                ) : (
                  t('jokers.consume.submit')
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
