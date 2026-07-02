/**
 * Installment-ownership contracts — the platform's headline feature.
 *
 * A buyer turns an `installment` listing into a plan (deposit + monthly
 * schedule). The plan walks a state machine; paying the deposit activates it,
 * paying the final installment completes it.
 */

import { z } from 'zod';
import { INSTALLMENT } from '../constants';
import {
  InstallmentPlanStatus,
  PaymentProvider,
  enumValues,
  type InstallmentPaymentStatus as InstallmentPaymentStatusType,
  type InstallmentPlanStatus as InstallmentPlanStatusType,
} from '../enums';
import { phoneSchema } from './auth';

export const createPlanSchema = z.object({
  listingId: z.string().uuid(),
  depositPercent: z.coerce
    .number()
    .min(INSTALLMENT.MIN_DEPOSIT_PERCENT)
    .max(INSTALLMENT.MAX_DEPOSIT_PERCENT),
  months: z.coerce.number().int().positive().max(INSTALLMENT.MAX_MONTHS),
});
export type CreatePlanInput = z.infer<typeof createPlanSchema>;

/** Used to start the deposit or an installment payment. */
export const payViaSchema = z.object({
  provider: z.enum(enumValues(PaymentProvider)),
  phone: phoneSchema.optional(),
});
export type PayViaInput = z.infer<typeof payViaSchema>;

/** Allowed plan state transitions (also enforced server-side). */
export const PLAN_TRANSITIONS: Record<InstallmentPlanStatusType, InstallmentPlanStatusType[]> =
  {
    [InstallmentPlanStatus.PENDING_DEPOSIT]: [
      InstallmentPlanStatus.ACTIVE,
      InstallmentPlanStatus.CANCELLED,
    ],
    [InstallmentPlanStatus.ACTIVE]: [
      InstallmentPlanStatus.COMPLETED,
      InstallmentPlanStatus.DEFAULTED,
      InstallmentPlanStatus.CANCELLED,
    ],
    [InstallmentPlanStatus.COMPLETED]: [],
    [InstallmentPlanStatus.DEFAULTED]: [],
    [InstallmentPlanStatus.CANCELLED]: [],
  };

export interface InstallmentPaymentItem {
  id: string;
  sequence: number;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  status: InstallmentPaymentStatusType;
}

export interface InstallmentPlanResponse {
  id: string;
  listingId: string;
  buyerId: string;
  totalPrice: number;
  depositAmount: number;
  months: number;
  monthlyAmount: number;
  serviceFeePercent: number;
  currency: string;
  status: InstallmentPlanStatusType;
  nextDueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Plan + its schedule and progress totals (for the detail view + charts). */
export interface InstallmentPlanDetail extends InstallmentPlanResponse {
  schedule: InstallmentPaymentItem[];
  paidCount: number;
  remainingCount: number;
  paidAmount: number;
  remainingAmount: number;
}
