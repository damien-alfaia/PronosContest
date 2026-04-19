import { useEffect, useMemo, useState } from 'react';

import { useThemeStore, type Theme } from '@/stores/theme-store';

const MEDIA_QUERY = '(prefers-color-scheme: dark)';

const getSystemTheme = (): 'light' | 'dark' =>
  typeof window === 'undefined'
    ? 'light'
    : window.matchMedia(MEDIA_QUERY).matches
      ? 'dark'
      : 'light';

/**
 * Hook qui expose le thème courant + le thème résolu (light|dark) après
 * prise en compte de `prefers-color-scheme` quand theme === 'system'.
 */
export const useTheme = () => {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() =>
    getSystemTheme(),
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(MEDIA_QUERY);
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const resolvedTheme = useMemo<'light' | 'dark'>(
    () => (theme === 'system' ? systemTheme : theme),
    [theme, systemTheme],
  );

  return { theme, resolvedTheme, setTheme } as const;
};

export type { Theme };
