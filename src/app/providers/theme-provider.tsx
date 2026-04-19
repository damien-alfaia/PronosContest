import { useEffect, type ReactNode } from 'react';

import { useTheme } from '@/hooks/use-theme';

type Props = {
  children: ReactNode;
};

/**
 * Applique la classe `light`/`dark` sur <html> en fonction du thème résolu.
 */
export const ThemeProvider = ({ children }: Props) => {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  return <>{children}</>;
};
