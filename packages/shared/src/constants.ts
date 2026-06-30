/** Cross-cutting domain constants shared by the API and clients. */

import { Currency } from './enums';

/** Uganda is the launch market — UGX is the default currency. */
export const DEFAULT_CURRENCY: Currency = Currency.UGX;

/** Pagination defaults for list endpoints. */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Installment plan guardrails (business rules; legal terms confirmed separately). */
export const INSTALLMENT = {
  /** Minimum deposit a seller may require, as a percentage of total price. */
  MIN_DEPOSIT_PERCENT: 10,
  MAX_DEPOSIT_PERCENT: 90,
  /** Allowed plan durations offered in the UI (months). */
  ALLOWED_MONTHS: [12, 24, 36, 48] as const,
  MAX_MONTHS: 48,
  /** Days before a due date to send the "installment due soon" reminder. */
  REMINDER_LEAD_DAYS: 3,
} as const;

/** Property gallery image-upload rules (shared by the API validator and the
 *  web uploader so client and server agree on what's allowed). */
export const IMAGE_UPLOAD = {
  /** Max size of a single uploaded photo. */
  MAX_BYTES: 5 * 1024 * 1024,
  /** MIME types accepted by the upload endpoint. */
  ACCEPTED_MIME_TYPES: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
  ] as const,
  /** Soft cap on how many photos a single property gallery may hold. */
  MAX_PER_PROPERTY: 12,
} as const;

/** WGS84 spatial reference id used for all PostGIS geography columns. */
export const SRID_WGS84 = 4326;

/** Default radius (metres) for "properties near me" map searches. */
export const DEFAULT_SEARCH_RADIUS_M = 5000;
