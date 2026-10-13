import toast from 'react-hot-toast';
import type { NavigateFunction } from 'react-router-dom';
import type { PaymentInitiation } from '@genuine-homes/shared';

/**
 * Send the payer to the gateway's checkout. Real gateways return an external
 * https URL (hard redirect); the dev mock returns an in-app path (router nav).
 */
export function goToCheckout(redirectUrl: string | null, navigate: NavigateFunction): void {
  if (!redirectUrl) return;
  if (/^https?:\/\//.test(redirectUrl)) {
    window.location.href = redirectUrl;
  } else {
    navigate(redirectUrl);
  }
}

/**
 * Route the payer after initiating a payment. Online methods return a checkout
 * URL to visit; cash has none — it's recorded pending for the owner to confirm,
 * so we just send the payer to their payments list with a heads-up.
 */
export function handlePaymentResult(
  result: PaymentInitiation,
  navigate: NavigateFunction,
): void {
  if (result.redirectUrl) {
    toast.success('Opening checkout…');
    goToCheckout(result.redirectUrl, navigate);
    return;
  }
  toast.success('Recorded. Pay the owner in cash — they confirm once received.');
  navigate('/payments');
}
