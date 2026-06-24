import { QueryClient } from '@tanstack/react-query';

// Shared client. Search/detail data is read-heavy, so keep it fresh for a bit
// and don't refetch on every window focus.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});
