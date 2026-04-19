import { type ReactNode } from 'react';

import { AuthProvider } from '@/app/providers/auth-provider';
import { QueryProvider } from '@/app/providers/query-provider';
import { ThemeProvider } from '@/app/providers/theme-provider';
import { Toaster } from '@/components/ui/sonner';

type Props = {
  children: ReactNode;
};

/**
 * Ordre :
 *   Query → Theme → Auth
 *
 * - Query doit englober tout (hooks `useQuery` partout)
 * - Theme applique la classe <html> au plus tôt
 * - Auth peut déclencher des queries (profile) au moment où la session arrive
 */
export const Providers = ({ children }: Props) => (
  <QueryProvider>
    <ThemeProvider>
      <AuthProvider>
        {children}
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </ThemeProvider>
  </QueryProvider>
);
