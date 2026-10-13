/**
 * Shared error shown when a buyer tries to pay for a property they haven't
 * viewed yet. The purchase, rent, and installment flows all enforce the gate
 * via BookingsService.hasCompletedViewing before taking any money.
 */
export const VIEWING_REQUIRED_MESSAGE =
  'Please complete a viewing of this property before paying. Book a viewing — once the owner accepts and the scheduled time has passed, you can proceed to payment.';
