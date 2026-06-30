import type { PaymentPurpose } from '@genuine-homes/shared';

/**
 * Emitted when a payment settles successfully. Other modules (installments,
 * rentals) subscribe via `@OnEvent` — keeping payments decoupled from what
 * happens next. Carried as a constant + typed payload so subscribers stay
 * compile-time safe without a module dependency on payments internals.
 */
export const PAYMENT_SUCCEEDED = 'payment.succeeded';

export interface PaymentSucceededEvent {
  paymentId: string;
  userId: string;
  purpose: PaymentPurpose;
  referenceId: string | null;
  amount: number;
}

/**
 * Emitted when a payment is settled as failed. The notifications module
 * subscribes to alert the payer; financial modules ignore it (a failed payment
 * changes no plan/rental state).
 */
export const PAYMENT_FAILED = 'payment.failed';

export interface PaymentFailedEvent {
  paymentId: string;
  userId: string;
  purpose: PaymentPurpose;
  referenceId: string | null;
  amount: number;
}
