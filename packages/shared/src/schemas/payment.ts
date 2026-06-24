/**
 * Payment contracts shared by the API and clients.
 *
 * `provider` is the payment *method* (MoMo / Airtel / card / bank); the gateway
 * (e.g. Flutterwave) is an implementation detail of the backend. Amounts are
 * numbers on the wire and Decimal in the database.
 */

import { z } from 'zod';
import { DEFAULT_CURRENCY } from '../constants';
import {
  PaymentProvider,
  PaymentPurpose,
  enumValues,
  type PaymentProvider as PaymentProviderType,
  type PaymentPurpose as PaymentPurposeType,
  type PaymentStatus as PaymentStatusType,
} from '../enums';
import { phoneSchema } from './auth';

export const initiatePaymentSchema = z.object({
  purpose: z.enum(enumValues(PaymentPurpose)),
  /** The record this payment settles (a plan, listing, etc.) — by purpose. */
  referenceId: z.string().uuid().optional(),
  amount: z.coerce.number().positive().max(1e12),
  currency: z.string().trim().toUpperCase().length(3).default(DEFAULT_CURRENCY),
  provider: z.enum(enumValues(PaymentProvider)),
  /** Payer phone (needed for Mobile Money); defaults to the account's phone. */
  phone: phoneSchema.optional(),
  /** Where the gateway should send the payer back after a hosted checkout. */
  redirectUrl: z.string().url().max(2048).optional(),
});
export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;

export interface PaymentResponse {
  id: string;
  purpose: PaymentPurposeType;
  referenceId: string | null;
  amount: number;
  currency: string;
  provider: PaymentProviderType;
  providerRef: string | null;
  status: PaymentStatusType;
  createdAt: string;
  updatedAt: string;
}

/** Result of starting a payment: the ledger row + where to send the payer. */
export interface PaymentInitiation {
  payment: PaymentResponse;
  redirectUrl: string | null;
}
