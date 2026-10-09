import type {
  BookingResponse,
  CreateBookingInput,
  Paginated,
} from '@genuine-homes/shared';
import { api } from '@/lib/apiClient';

export const bookingsApi = {
  // Viewings the current user has requested.
  mine: (page = 1, pageSize = 50) =>
    api
      .get<Paginated<BookingResponse>>('/bookings/mine', { params: { page, pageSize } })
      .then((r) => r.data),
  // Viewing requests on the current user's properties (owner view).
  incoming: (page = 1, pageSize = 50) =>
    api
      .get<Paginated<BookingResponse>>('/bookings/incoming', { params: { page, pageSize } })
      .then((r) => r.data),
  create: (input: CreateBookingInput) =>
    api.post<BookingResponse>('/bookings', input).then((r) => r.data),
  accept: (id: string) =>
    api.post<BookingResponse>(`/bookings/${id}/accept`, {}).then((r) => r.data),
  decline: (id: string, reason?: string) =>
    api.post<BookingResponse>(`/bookings/${id}/decline`, { reason }).then((r) => r.data),
  cancel: (id: string) =>
    api.post<BookingResponse>(`/bookings/${id}/cancel`, {}).then((r) => r.data),
};
