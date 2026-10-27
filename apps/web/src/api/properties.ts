import type {
  CreateListingInput,
  CreatePropertyInput,
  ListingResponse,
  ManagedAgentResponse,
  Paginated,
  PropertyDetail,
  PropertyImageResponse,
  PropertySummary,
  UpdatePropertyInput,
} from '@genuine-homes/shared';
import { api } from '@/lib/apiClient';

export const propertiesApi = {
  get: (id: string) => api.get<PropertyDetail>(`/properties/${id}`).then((r) => r.data),
  listMine: (page: number, pageSize: number) =>
    api
      .get<Paginated<PropertySummary>>('/properties/mine', {
        params: { page, pageSize },
      })
      .then((r) => r.data),
  create: (input: CreatePropertyInput) =>
    api.post<PropertyDetail>('/properties', input).then((r) => r.data),
  update: (id: string, input: UpdatePropertyInput) =>
    api.patch<PropertyDetail>(`/properties/${id}`, input).then((r) => r.data),
  remove: (id: string) => api.delete(`/properties/${id}`).then((r) => r.data),
  addListing: (propertyId: string, input: CreateListingInput) =>
    api.post<ListingResponse>(`/properties/${propertyId}/listings`, input).then((r) => r.data),
  // Attach an (already-uploaded or external) image URL to a property's gallery.
  // Omit position to append to the end.
  addImage: (propertyId: string, url: string, position?: number) =>
    api
      .post<PropertyImageResponse>(`/properties/${propertyId}/images`, {
        url,
        position,
      })
      .then((r) => r.data),
  removeImage: (propertyId: string, imageId: string) =>
    api.delete(`/properties/${propertyId}/images/${imageId}`).then((r) => r.data),
  // Agents the owner/manager has assigned to help run the property.
  listAgents: (propertyId: string) =>
    api.get<ManagedAgentResponse[]>(`/properties/${propertyId}/agents`).then((r) => r.data),
  assignAgent: (propertyId: string, emailOrPhone: string) =>
    api
      .post<ManagedAgentResponse>(`/properties/${propertyId}/agents`, { emailOrPhone })
      .then((r) => r.data),
  unassignAgent: (propertyId: string, agentId: string) =>
    api.delete(`/properties/${propertyId}/agents/${agentId}`).then((r) => r.data),
};
