/**
 * Rental agreement contracts. A tenant starts an agreement from a `rent`
 * listing, then pays rent through the unified payments ledger
 * (purpose = `rent`, referenceId = agreement id). The agreement activates when
 * the first rent payment settles.
 */

import { z } from 'zod';
import type { RentalAgreementStatus as RentalAgreementStatusType } from '../enums';

export const RENTAL = {
  MIN_MONTHS: 1,
  MAX_MONTHS: 60,
} as const;

export const createRentalSchema = z.object({
  listingId: z.string().uuid(),
  /** Move-in date, `YYYY-MM-DD`. */
  startDate: z.string().date(),
  /** Term length; when given, the end date is start + months. */
  months: z.coerce.number().int().min(RENTAL.MIN_MONTHS).max(RENTAL.MAX_MONTHS).optional(),
});
export type CreateRentalInput = z.infer<typeof createRentalSchema>;

export interface RentalAgreementResponse {
  id: string;
  listingId: string;
  tenantId: string;
  startDate: string;
  endDate: string | null;
  monthlyRent: number;
  currency: string;
  status: RentalAgreementStatusType;
  createdAt: string;
  updatedAt: string;
}
