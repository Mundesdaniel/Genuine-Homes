import { timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider, PaymentStatus } from '@genuine-homes/shared';
import type { Env } from '../../config/env.validation';
import type {
  InitiateChargeInput,
  InitiateChargeResult,
  PaymentGateway,
  VerifiedTransaction,
  WebhookEvent,
} from './payment-gateway.interface';

const FLW_API_BASE = 'https://api.flutterwave.com/v3';
const FLW_PAYMENTS_URL = `${FLW_API_BASE}/payments`;

// Map our payment method to Flutterwave's `payment_options`.
const PAYMENT_OPTIONS: Record<string, string> = {
  [PaymentProvider.MTN_MOMO]: 'mobilemoneyuganda',
  [PaymentProvider.AIRTEL_MONEY]: 'mobilemoneyuganda',
  [PaymentProvider.CARD]: 'card',
  [PaymentProvider.BANK]: 'banktransfer',
};

/**
 * Flutterwave gateway (Standard hosted checkout). Used when a secret key is
 * configured. Webhook authenticity is the static `verif-hash` header compared
 * against the configured webhook secret.
 */
@Injectable()
export class FlutterwaveGateway implements PaymentGateway {
  readonly name = 'flutterwave';
  private readonly logger = new Logger(FlutterwaveGateway.name);
  private readonly secret: string;
  private readonly webhookHash: string | undefined;

  constructor(config: ConfigService<Env, true>) {
    this.secret = config.get('FLUTTERWAVE_SECRET_KEY', { infer: true }) as string;
    this.webhookHash = config.get('FLUTTERWAVE_WEBHOOK_HASH', { infer: true });
  }

  async initiate(input: InitiateChargeInput): Promise<InitiateChargeResult> {
    const response = await fetch(FLW_PAYMENTS_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: input.paymentId,
        amount: input.amount,
        currency: input.currency,
        redirect_url: input.redirectUrl,
        payment_options: PAYMENT_OPTIONS[input.method],
        customer: {
          email: input.customer.email ?? `${input.customer.phone}@no-email.genuinehomes.ug`,
          phonenumber: input.customer.phone,
          name: input.customer.name,
        },
        meta: { purpose: input.purpose },
      }),
    });

    const json = (await response.json().catch(() => null)) as
      | { status?: string; data?: { link?: string } }
      | null;
    if (!response.ok || json?.status !== 'success' || !json.data?.link) {
      this.logger.error(`Flutterwave initiation failed (HTTP ${response.status})`);
      throw new Error('Flutterwave payment initiation failed');
    }
    // The transaction id is only known once the payment completes (webhook).
    return { providerRef: null, redirectUrl: json.data.link };
  }

  verifySignature(headers: Record<string, unknown>): boolean {
    const provided = headers['verif-hash'];
    if (!this.webhookHash || typeof provided !== 'string') return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(this.webhookHash);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parseWebhook(body: unknown): WebhookEvent | null {
    const data = (body as { data?: Record<string, unknown> } | null)?.data;
    const txRef = data?.tx_ref as string | undefined;
    const id = data?.id;
    if (!txRef || id == null) return null;
    const raw = String(data?.status ?? '').toLowerCase();
    const status =
      raw === 'successful'
        ? PaymentStatus.SUCCESSFUL
        : raw === 'failed'
          ? PaymentStatus.FAILED
          : PaymentStatus.PENDING;
    return { txRef, providerRef: String(id), status };
  }

  /**
   * Server-to-server confirmation: GET /transactions/:id/verify. Called before
   * settling a successful webhook so a forged/tampered body can never mark a
   * payment paid — the settle decision uses what Flutterwave's API says, not
   * what the webhook claimed.
   */
  async verifyTransaction(providerRef: string): Promise<VerifiedTransaction | null> {
    const response = await fetch(
      `${FLW_API_BASE}/transactions/${encodeURIComponent(providerRef)}/verify`,
      { headers: { authorization: `Bearer ${this.secret}` } },
    );
    const json = (await response.json().catch(() => null)) as {
      status?: string;
      data?: { tx_ref?: string; status?: string; amount?: number; currency?: string };
    } | null;
    if (!response.ok || json?.status !== 'success' || !json.data?.tx_ref) {
      this.logger.error(
        `Flutterwave transaction verify failed for ${providerRef} (HTTP ${response.status})`,
      );
      return null;
    }
    const raw = String(json.data.status ?? '').toLowerCase();
    return {
      txRef: json.data.tx_ref,
      status:
        raw === 'successful'
          ? PaymentStatus.SUCCESSFUL
          : raw === 'failed'
            ? PaymentStatus.FAILED
            : PaymentStatus.PENDING,
      amount: Number(json.data.amount ?? 0),
      currency: String(json.data.currency ?? ''),
    };
  }
}
