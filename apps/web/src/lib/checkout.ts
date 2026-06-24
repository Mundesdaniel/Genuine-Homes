import type { NavigateFunction } from 'react-router-dom';

/**
 * Send the payer to the gateway's checkout. Real gateways return an external
 * https URL (hard redirect); the dev mock returns an in-app path (router nav).
 */
export function goToCheckout(
  redirectUrl: string | null,
  navigate: NavigateFunction,
): void {
  if (!redirectUrl) return;
  if (/^https?:\/\//.test(redirectUrl)) {
    window.location.href = redirectUrl;
  } else {
    navigate(redirectUrl);
  }
}
