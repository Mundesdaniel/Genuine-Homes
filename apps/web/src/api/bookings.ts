import type { BookingResponse, CreateBookingInput, Paginated } from '@genuine-homes/shared';
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
  // Confirm the viewing happened (buyer or owner) — unlocks payment.
  markViewed: (id: string) =>
    api.post<BookingResponse>(`/bookings/${id}/viewed`, {}).then((r) => r.data),
  // Viewing state for this listing's property: whether it's complete (unlocks
  // payment) and the id of an accepted viewing still awaiting confirmation.
  viewingStatus: (listingId: string) =>
    api
      .get<{ completed: boolean; bookingId: string | null }>(
        `/bookings/viewing-status/${listingId}`,
      )
      .then((r) => r.data),
};
