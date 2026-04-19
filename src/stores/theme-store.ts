import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

/**
 * Store du thème (persisté dans localStorage).
 *
 * La valeur brute peut être 'system' ; la résolution (light/dark) se fait
 * dans le provider, qui écoute aussi `prefers-color-scheme`.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'pronos-theme',
      version: 1,
    },
  ),
);
