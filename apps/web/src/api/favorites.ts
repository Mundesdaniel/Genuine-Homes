import type {
  FavoriteIdsResponse,
  ListingSearchItem,
  Paginated,
} from '@genuine-homes/shared';
import { api } from '@/lib/apiClient';

export const favoritesApi = {
  list: (page: number, pageSize: number) =>
    api
      .get<Paginated<ListingSearchItem>>('/favorites', {
        params: { page, pageSize },
      })
      .then((r) => r.data),
  ids: () =>
    api.get<FavoriteIdsResponse>('/favorites/ids').then((r) => r.data),
  add: (propertyId: string) =>
    api.post(`/favorites/${propertyId}`).then((r) => r.data),
  remove: (propertyId: string) =>
    api.delete(`/favorites/${propertyId}`).then((r) => r.data),
};
