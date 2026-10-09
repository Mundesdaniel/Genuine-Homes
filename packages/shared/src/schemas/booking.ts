/**
 * Viewing bookings. A buyer requests to view a property in person on a
 * preferred date/time; the owner (seller/agent/landlord who posted it) accepts
 * or declines. Both parties see the booking with its status.
 */

import { z } from 'zod';
import type { BookingStatus as BookingStatusType } from '../enums';

export const BOOKING = {
  MESSAGE_MAX: 500,
} as const;

export const createBookingSchema = z.object({
  listingId: z.string().uuid(),
  /** Preferred date + time of the viewing, as an ISO-8601 datetime string. */
  scheduledAt: z.string().datetime(),
  message: z.string().trim().max(BOOKING.MESSAGE_MAX).optional(),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

/** Declining a booking may carry a short reason (shown to the buyer). */
export const declineBookingSchema = z.object({
  reason: z.string().trim().max(BOOKING.MESSAGE_MAX).optional(),
});
export type DeclineBookingInput = z.infer<typeof declineBookingSchema>;

export interface BookingResponse {
  id: string;
  listingId: string;
  propertyId: string;
  buyerId: string;
  ownerId: string;
  scheduledAt: string;
  message: string | null;
  status: BookingStatusType;
  createdAt: string;
  updatedAt: string;
  /** Display context so a list row needs no extra lookups. */
  propertyTitle: string;
  buyer: { id: string; fullName: string; phone: string };
}
