/**
 * Listing contracts (rent / sale / installment) shared by the API and clients.
 *
 * A listing is how a property is offered. The three listing types each carry
 * different fields, enforced by `listingShapeError` — used both in the Zod
 * schema here (client-side) and in the API service (authoritative).
 */

import { z } from 'zod';
import { INSTALLMENT, DEFAULT_CURRENCY, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants';
import {
  ListingType,
  PropertyType,
  RentPeriod,
  enumValues,
  type RentPeriod as RentPeriodType,
} from '../enums';
import type { PropertySummary } from './property';

// The cross-field fields that the rule below inspects.
export interface ListingShape {
  listingType: ListingType;
  rentPeriod?: RentPeriodType | null;
  minDepositPercent?: number | null;
  maxInstallmentMonths?: number | null;
}

/**
 * Validate the type-specific fields of a listing. Returns an error message, or
 * null when the shape is valid. Single source of truth for the rule.
 */
export function listingShapeError(input: ListingShape): string | null {
  const hasInstallmentTerms =
    input.minDepositPercent != null || input.maxInstallmentMonths != null;

  switch (input.listingType) {
    case ListingType.RENT:
      if (!input.rentPeriod) return 'Rent listings require a rentPeriod';
      if (hasInstallmentTerms) return 'Rent listings cannot have installment terms';
      return null;
    case ListingType.SALE:
      if (input.rentPeriod) return 'Sale listings cannot have a rentPeriod';
      if (hasInstallmentTerms) return 'Sale listings cannot have installment terms';
      return null;
    case ListingType.INSTALLMENT:
      if (input.rentPeriod) return 'Installment listings cannot have a rentPeriod';
      if (input.minDepositPercent == null || input.maxInstallmentMonths == null) {
        return 'Installment listings require minDepositPercent and maxInstallmentMonths';
      }
      return null;
    default:
      return null;
  }
}

const listingBase = z.object({
  listingType: z.enum(enumValues(ListingType)),
  price: z.coerce.number().positive().max(1e12),
  currency: z.string().trim().toUpperCase().length(3).default(DEFAULT_CURRENCY),
  rentPeriod: z.enum(enumValues(RentPeriod)).optional(),
  minDepositPercent: z.coerce
    .number()
    .min(INSTALLMENT.MIN_DEPOSIT_PERCENT)
    .max(INSTALLMENT.MAX_DEPOSIT_PERCENT)
    .optional(),
  maxInstallmentMonths: z.coerce
    .number()
    .int()
    .positive()
    .max(INSTALLMENT.MAX_MONTHS)
    .optional(),
  isActive: z.boolean().default(true),
});

// Attach the cross-field rule as a refinement so clients get the same errors.
const withShapeRule = <T extends z.ZodTypeAny>(schema: T): z.ZodEffects<T> =>
  schema.superRefine((value, ctx) => {
    const message = listingShapeError(value as ListingShape);
    if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  });

export const createListingSchema = withShapeRule(listingBase);
export type CreateListingInput = z.infer<typeof createListingSchema>;

// All fields optional on update; the rule runs against the merged entity in the
// service (it can't run here because partial input lacks the other fields).
export const updateListingSchema = listingBase.partial();
export type UpdateListingInput = z.infer<typeof updateListingSchema>;

/** Query params for the public listing search. */
export const searchListingsSchema = z.object({
  district: z.string().trim().min(1).optional(),
  type: z.enum(enumValues(PropertyType)).optional(),
  listingType: z.enum(enumValues(ListingType)).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  minBedrooms: z.coerce.number().int().min(0).optional(),
  onlyVerified: z.coerce.boolean().optional(),
  // "Near me": all three required together for a radius search.
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusM: z.coerce.number().positive().max(200_000).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'distance']).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});
export type SearchListingsInput = z.infer<typeof searchListingsSchema>;

// ── Response shapes ────────────────────────────────────────────────────────

export interface ListingResponse {
  id: string;
  propertyId: string;
  listingType: ListingType;
  price: number; // UGX is zero-decimal and well within safe-integer range
  currency: string;
  rentPeriod: RentPeriodType | null;
  minDepositPercent: number | null;
  maxInstallmentMonths: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A search hit: the listing plus its property and (for geo searches) distance. */
export interface ListingSearchItem extends ListingResponse {
  property: PropertySummary;
  distanceM: number | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
