import type {
  PaymentProvider,
  PaymentPurpose,
  PaymentStatus,
} from '@genuine-homes/shared';

/** DI token for the active payment gateway (Strategy pattern). */
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface InitiateChargeInput {
  paymentId: string; // our ledger id — used as the gateway tx_ref
  amount: number;
  currency: string;
  method: PaymentProvider; // momo / airtel / card / bank
  customer: { name: string; email: string | null; phone: string };
  purpose: PaymentPurpose;
  redirectUrl?: string;
}

export interface InitiateChargeResult {
  /** Gateway reference, if known now (often only available via the webhook). */
  providerRef: string | null;
  /** Hosted checkout URL to send the payer to, if any. */
  redirectUrl: string | null;
}

export interface WebhookEvent {
  txRef: string; // our ledger id
  providerRef: string; // the gateway's transaction id
  status: PaymentStatus;
}

/** Transaction details re-fetched from the gateway's API (server-to-server). */
export interface VerifiedTransaction {
  txRef: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
}

/**
 * A payment gateway. Swapping providers (or running a mock in dev) is just a
 * different implementation behind this interface.
 */
export interface PaymentGateway {
  readonly name: string;
  initiate(input: InitiateChargeInput): Promise<InitiateChargeResult>;
  /** Validate the authenticity of an incoming webhook from its headers. */
  verifySignature(headers: Record<string, unknown>): boolean;
  /** Normalise a webhook body into an event, or null if unrecognised. */
  parseWebhook(body: unknown): WebhookEvent | null;
  /**
   * Re-fetch the transaction from the provider's API before settling a
   * *successful* webhook — webhooks prove authenticity (signature), this
   * proves amount/currency/status against tampering or truncation. Optional:
   * gateways without a verify endpoint (the mock) omit it and the webhook is
   * trusted as-is.
   */
  verifyTransaction?(providerRef: string): Promise<VerifiedTransaction | null>;
}
