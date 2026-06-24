/**
 * Property contracts shared by the API and clients.
 *
 * Coordinates are accepted as plain `latitude`/`longitude`; the API stores them
 * in a PostGIS `geography(Point)` column. Money/size are numbers on the wire
 * (stored as Decimal server-side).
 */

import { z } from 'zod';
import {
  PropertyStatus,
  PropertyType,
  enumValues,
  type PropertyStatus as PropertyStatusType,
  type PropertyType as PropertyTypeType,
  type VerificationStatus as VerificationStatusType,
} from '../enums';
import type { ListingResponse } from './listing';

// Statuses an owner may set themselves. `rented`/`sold` are driven by other
// flows (rentals, installment completion), so they aren't user-settable here.
export const OWNER_SETTABLE_STATUSES = [
  PropertyStatus.DRAFT,
  PropertyStatus.ACTIVE,
  PropertyStatus.SUSPENDED,
] as const;

const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);

const propertyBase = z.object({
  type: z.enum(enumValues(PropertyType)),
  title: z.string().trim().min(4).max(150),
  description: z.string().trim().min(10).max(5000),
  district: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  area: z.string().trim().max(100).optional(),
  sizeSqm: z.coerce.number().positive().max(1_000_000).optional(),
  bedrooms: z.coerce.number().int().min(0).max(100).optional(),
  bathrooms: z.coerce.number().int().min(0).max(100).optional(),
  amenities: z.record(z.string(), z.boolean()).default({}),
  status: z.enum(OWNER_SETTABLE_STATUSES).optional(),
  latitude: latitude.optional(),
  longitude: longitude.optional(),
});

// latitude and longitude must be supplied together (or not at all).
const coordsPaired = (value: {
  latitude?: number;
  longitude?: number;
}): boolean => (value.latitude == null) === (value.longitude == null);
const coordsError = {
  message: 'latitude and longitude must be provided together',
  path: ['latitude'],
};

export const createPropertySchema = propertyBase.refine(coordsPaired, coordsError);
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;

export const updatePropertySchema = propertyBase
  .partial()
  .refine(coordsPaired, coordsError);
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;

export const addImageSchema = z.object({
  url: z.string().url().max(2048),
  position: z.coerce.number().int().min(0).max(100).optional(),
});
export type AddImageInput = z.infer<typeof addImageSchema>;

// ── Response shapes ────────────────────────────────────────────────────────

export interface PropertySummary {
  id: string;
  ownerId: string;
  type: PropertyTypeType;
  title: string;
  description: string;
  district: string;
  city: string;
  area: string | null;
  sizeSqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  amenities: Record<string, boolean>;
  verificationStatus: VerificationStatusType;
  status: PropertyStatusType;
  latitude: number | null;
  longitude: number | null;
  /** First gallery image, for list/card views. */
  coverImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyImageResponse {
  id: string;
  url: string;
  position: number;
}

/** Full property view: the summary plus its gallery and listings. */
export interface PropertyDetail extends PropertySummary {
  images: PropertyImageResponse[];
  listings: ListingResponse[];
}
