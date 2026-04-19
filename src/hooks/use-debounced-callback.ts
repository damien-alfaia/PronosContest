import { useCallback, useEffect, useRef } from 'react';

/**
 * Retourne un callback debouncé stable + un `flush` pour forcer l'appel
 * en cours (ex : sur blur / unmount / save explicite).
 *
 * - La référence au callback est maintenue à jour via un ref pour éviter
 *   de recréer un timer à chaque render (sinon on perd le debounce si
 *   l'appelant fait une nouvelle closure à chaque render).
 * - Le cleanup annule le timer en pending au démontage.
 *
 * Utilisé par MatchCard pour l'auto-save des pronos.
 */
export const useDebouncedCallback = <TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delayMs: number,
): {
  run: (...args: TArgs) => void;
  flush: () => void;
  cancel: () => void;
} => {
  const cbRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgsRef = useRef<TArgs | null>(null);

  useEffect(() => {
    cbRef.current = callback;
  }, [callback]);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingArgsRef.current = null;
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const args = pendingArgsRef.current;
    pendingArgsRef.current = null;
    if (args) cbRef.current(...args);
  }, []);

  const run = useCallback(
    (...args: TArgs) => {
      pendingArgsRef.current = args;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const pending = pendingArgsRef.current;
        pendingArgsRef.current = null;
        if (pending) cbRef.current(...pending);
      }, delayMs);
    },
    [delayMs],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  return { run, flush, cancel };
};
