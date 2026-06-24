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
