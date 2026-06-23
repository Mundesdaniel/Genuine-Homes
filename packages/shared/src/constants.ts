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
} as const;

/** WGS84 spatial reference id used for all PostGIS geography columns. */
export const SRID_WGS84 = 4326;

/** Default radius (metres) for "properties near me" map searches. */
export const DEFAULT_SEARCH_RADIUS_M = 5000;
