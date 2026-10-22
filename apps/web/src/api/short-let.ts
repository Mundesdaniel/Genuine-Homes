import type {
  CreateAvailabilityBlockInput,
  CreateShortLetBookingInput,
  ShortLetAvailabilityBlockResponse,
  ShortLetBookingResponse,
  ShortLetDashboardResponse,
} from '@genuine-homes/shared';
import { api } from '@/lib/apiClient';

export const shortLetApi = {
  /** The agent's short-let dashboard (listings, income, occupancy). */
  dashboard: () =>
    api.get<ShortLetDashboardResponse>('/short-let/dashboard').then((r) => r.data),
  /** Record a nightly stay (marks the listing short-let). */
  createBooking: (input: CreateShortLetBookingInput) =>
    api.post<ShortLetBookingResponse>('/short-let/bookings', input).then((r) => r.data),
  /** Block a date range as unavailable. */
  createBlock: (input: CreateAvailabilityBlockInput) =>
    api
      .post<ShortLetAvailabilityBlockResponse>('/short-let/availability', input)
      .then((r) => r.data),
};
