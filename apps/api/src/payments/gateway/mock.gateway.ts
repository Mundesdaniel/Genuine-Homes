import { Injectable, Logger } from '@nestjs/common';
import { PaymentStatus } from '@genuine-homes/shared';
import type {
  InitiateChargeInput,
  InitiateChargeResult,
  PaymentGateway,
  WebhookEvent,
} from './payment-gateway.interface';

/**
 * Dev/test gateway used when no Flutterwave key is configured. It never moves
 * money — it returns a fake checkout URL and accepts a simple webhook body
 * (`{ tx_ref, status }`) so the full flow can be exercised end-to-end locally.
 */
@Injectable()
export class MockGateway implements PaymentGateway {
  readonly name = 'mock';
  private readonly logger = new Logger(MockGateway.name);

  async initiate(input: InitiateChargeInput): Promise<InitiateChargeResult> {
    this.logger.warn(
      `MOCK gateway: pretending to charge ${input.amount} ${input.currency} via ${input.method} (no real payment)`,
    );
    return {
      providerRef: `mock_${input.paymentId}`,
      redirectUrl: `/payments/mock-checkout/${input.paymentId}`,
    };
  }

  // No real signature in dev.
  verifySignature(): boolean {
    return true;
  }

  parseWebhook(body: unknown): WebhookEvent | null {
    const b = (body ?? {}) as Record<string, unknown>;
    const txRef = (b.tx_ref ?? b.txRef) as string | undefined;
    if (!txRef) return null;
    const status =
      b.status === 'failed' ? PaymentStatus.FAILED : PaymentStatus.SUCCESSFUL;
    return {
      txRef,
      providerRef: (b.id as string) ?? `mock_${txRef}`,
      status,
    };
  }
}
