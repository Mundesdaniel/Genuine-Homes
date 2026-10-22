/**
 * Short-let ("AirBnB") agent dashboard contracts: nightly stay bookings,
 * availability blocks, and the computed dashboard (income + occupancy). Gated by
 * the airbnb_agent role + an active subscription.
 */

import { z } from 'zod';
import type {
  ShortLetBookingStatus as ShortLetBookingStatusType,
  SubscriptionStatus as SubscriptionStatusType,
} from '../enums';

export const SHORT_LET = {
  GUEST_MAX: 120,
  NOTE_MAX: 200,
} as const;

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date');

/** Record a nightly stay. [checkIn, checkOut) — checkOut must be after checkIn. */
export const createShortLetBookingSchema = z
  .object({
    listingId: z.string().uuid(),
    checkIn: dateOnly,
    checkOut: dateOnly,
    amount: z.number().positive().max(1e12),
    currency: z.string().length(3).optional(),
    guestName: z.string().trim().max(SHORT_LET.GUEST_MAX).optional(),
  })
  .refine((v) => v.checkOut > v.checkIn, {
    message: 'Check-out must be after check-in',
    path: ['checkOut'],
  });
export type CreateShortLetBookingInput = z.infer<typeof createShortLetBookingSchema>;

/** Block a date range as unavailable. [startDate, endDate] inclusive. */
export const createAvailabilityBlockSchema = z
  .object({
    listingId: z.string().uuid(),
    startDate: dateOnly,
    endDate: dateOnly,
    note: z.string().trim().max(SHORT_LET.NOTE_MAX).optional(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'End date cannot be before the start date',
    path: ['endDate'],
  });
export type CreateAvailabilityBlockInput = z.infer<typeof createAvailabilityBlockSchema>;

export interface ShortLetBookingResponse {
  id: string;
  listingId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  amount: number;
  currency: string;
  guestName: string | null;
  status: ShortLetBookingStatusType;
  createdAt: string;
}

export interface ShortLetAvailabilityBlockResponse {
  id: string;
  listingId: string;
  startDate: string;
  endDate: string;
  note: string | null;
}

/** One short-let listing with its bookings, blocks and computed metrics. */
export interface ShortLetListingSummary {
  listingId: string;
  propertyId: string;
  title: string;
  currency: string;
  nightlyPrice: number;
  income: number;
  bookedNights: number;
  availableNights: number;
  occupancyRate: number; // 0..1 over the dashboard window
  bookings: ShortLetBookingResponse[];
  blocks: ShortLetAvailabilityBlockResponse[];
}

/** A listing the agent owns that can be turned into a short-let (for pickers). */
export interface SelectableListing {
  listingId: string;
  title: string;
  isShortLet: boolean;
}

export interface ShortLetDashboardResponse {
  subscription: {
    plan: string;
    status: SubscriptionStatusType;
    expiresAt: string;
  };
  /** The occupancy window metrics are computed over (inclusive start, exclusive end). */
  window: { start: string; end: string; nights: number };
  totals: {
    income: number;
    currency: string;
    occupancyRate: number;
    listings: number;
    bookings: number;
  };
  /** Income grouped by month for the trend chart. */
  incomeByMonth: { month: string; amount: number }[];
  listings: ShortLetListingSummary[];
  /** All the agent's listings, so the booking/block forms can pick one. */
  selectableListings: SelectableListing[];
}
