import { useEffect, useMemo, useState } from 'react';

/**
 * Décompte vers une cible (timestamptz ISO).
 *
 * - Rafraîchit toutes les `tickMs` (défaut 30s : suffisant pour un
 *   décompte affiché en jours/heures/minutes — pas la peine de retick
 *   à la seconde).
 * - Renvoie `locked = true` dès que `now() >= target`.
 * - `parts` est calculé à partir de `diffMs` pour rester cohérent avec
 *   l'affichage : on n'expose pas un format texte ici, on laisse
 *   l'appelant l'adapter à sa locale (et éviter de coupler à i18next).
 *
 * Utilisé par MatchCard pour afficher "🔒 dans 2j 3h 12min".
 */

export type CountdownParts = {
  /** Temps restant en ms ; 0 si verrouillé. */
  diffMs: number;
  /** Composantes positives (toujours >= 0). */
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export type CountdownState = CountdownParts & {
  /** True dès que la cible est atteinte ou dépassée. */
  locked: boolean;
};

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const computeParts = (targetMs: number, nowMs: number): CountdownState => {
  const diffMs = targetMs - nowMs;
  if (diffMs <= 0) {
    return {
      diffMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      locked: true,
    };
  }
  const days = Math.floor(diffMs / MS_PER_DAY);
  const hours = Math.floor((diffMs % MS_PER_DAY) / MS_PER_HOUR);
  const minutes = Math.floor((diffMs % MS_PER_HOUR) / MS_PER_MINUTE);
  const seconds = Math.floor((diffMs % MS_PER_MINUTE) / MS_PER_SECOND);
  return { diffMs, days, hours, minutes, seconds, locked: false };
};

export const useCountdown = (
  targetIso: string | undefined,
  tickMs: number = 30_000,
): CountdownState => {
  const targetMs = useMemo(
    () => (targetIso ? Date.parse(targetIso) : Number.NaN),
    [targetIso],
  );

  // État initial calculé sur le moment du premier render.
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (Number.isNaN(targetMs)) return undefined;
    // Tick immédiat pour caler le state si on revient depuis une page
    // figée depuis longtemps (ex: tab background).
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(id);
  }, [targetMs, tickMs]);

  if (Number.isNaN(targetMs)) {
    return { diffMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0, locked: true };
  }

  return computeParts(targetMs, now);
};
