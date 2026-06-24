import { timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider, PaymentStatus } from '@genuine-homes/shared';
import type { Env } from '../../config/env.validation';
import type {
  InitiateChargeInput,
  InitiateChargeResult,
  PaymentGateway,
  WebhookEvent,
} from './payment-gateway.interface';

const FLW_PAYMENTS_URL = 'https://api.flutterwave.com/v3/payments';

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
}
