import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

/**
 * Provider TanStack Query.
 *
 * - staleTime 30s (réduit les refetch intempestifs)
 * - refetchOnWindowFocus désactivé (on privilégie Realtime Supabase)
 * - retry: 1 (échec rapide, message à l'utilisateur)
 */
export const QueryProvider = ({ children }: Props) => {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
};
