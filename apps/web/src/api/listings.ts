import type {
  ListingSearchItem,
  Paginated,
  SearchListingsInput,
} from '@genuine-homes/shared';
import { api } from '@/lib/apiClient';

export const listingsApi = {
  // axios drops `undefined` params, so we can pass the whole filter object.
  search: (params: Partial<SearchListingsInput>) =>
    api
      .get<Paginated<ListingSearchItem>>('/listings', { params })
      .then((r) => r.data),
  get: (id: string) =>
    api.get<ListingSearchItem>(`/listings/${id}`).then((r) => r.data),
};
