import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FavoriteIdsResponse } from '@genuine-homes/shared';
import { favoritesApi } from '@/api/favorites';
import { useAuthStore } from '@/store/authStore';

const IDS_KEY = ['favorites', 'ids'];

/**
 * The set of property ids the current user has saved. Only fetched when logged
 * in; anonymous visitors get an empty set so favorite buttons render as "save".
 */
export function useFavoriteIds() {
  const token = useAuthStore((s) => s.accessToken);
  const query = useQuery({
    queryKey: IDS_KEY,
    queryFn: () => favoritesApi.ids(),
    enabled: Boolean(token),
    staleTime: 60_000,
  });
  const ids = new Set(query.data?.propertyIds ?? []);
  return { ids, isLoading: query.isLoading };
}

/**
 * Toggle a property's saved state with an optimistic cache update so the heart
 * flips instantly; the saved-list query is invalidated on settle.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, saved }: { propertyId: string; saved: boolean }) =>
      saved ? favoritesApi.remove(propertyId) : favoritesApi.add(propertyId),
    onMutate: async ({ propertyId, saved }) => {
      await queryClient.cancelQueries({ queryKey: IDS_KEY });
      const previous = queryClient.getQueryData<FavoriteIdsResponse>(IDS_KEY);
      const current = previous?.propertyIds ?? [];
      const next = saved
        ? current.filter((id) => id !== propertyId)
        : [...current, propertyId];
      queryClient.setQueryData<FavoriteIdsResponse>(IDS_KEY, { propertyIds: next });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(IDS_KEY, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: IDS_KEY });
      void queryClient.invalidateQueries({ queryKey: ['favorites', 'list'] });
    },
  });
}
