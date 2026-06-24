import type {
  CreateListingInput,
  CreatePropertyInput,
  ListingResponse,
  Paginated,
  PropertyDetail,
  PropertySummary,
} from '@genuine-homes/shared';
import { api } from '@/lib/apiClient';

export const propertiesApi = {
  get: (id: string) =>
    api.get<PropertyDetail>(`/properties/${id}`).then((r) => r.data),
  listMine: (page: number, pageSize: number) =>
    api
      .get<Paginated<PropertySummary>>('/properties/mine', {
        params: { page, pageSize },
      })
      .then((r) => r.data),
  create: (input: CreatePropertyInput) =>
    api.post<PropertyDetail>('/properties', input).then((r) => r.data),
  remove: (id: string) =>
    api.delete(`/properties/${id}`).then((r) => r.data),
  addListing: (propertyId: string, input: CreateListingInput) =>
    api
      .post<ListingResponse>(`/properties/${propertyId}/listings`, input)
      .then((r) => r.data),
};
