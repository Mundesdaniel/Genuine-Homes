import { ConfigService } from '@nestjs/config';
import { PaymentStatus } from '@genuine-homes/shared';
import type { Env } from '../../config/env.validation';
import { FlutterwaveGateway } from './flutterwave.gateway';

const config = {
  get: (key: string) =>
    ({
      FLUTTERWAVE_SECRET_KEY: 'FLWSECK_TEST-xxxx',
      FLUTTERWAVE_WEBHOOK_HASH: 'my-webhook-secret',
    })[key],
} as unknown as ConfigService<Env, true>;

describe('FlutterwaveGateway', () => {
  const gateway = new FlutterwaveGateway(config);

  describe('verifySignature', () => {
    it('accepts a matching verif-hash header', () => {
      expect(gateway.verifySignature({ 'verif-hash': 'my-webhook-secret' })).toBe(true);
    });
    it('rejects a wrong hash', () => {
      expect(gateway.verifySignature({ 'verif-hash': 'nope' })).toBe(false);
    });
    it('rejects a missing header', () => {
      expect(gateway.verifySignature({})).toBe(false);
    });
  });

  describe('parseWebhook', () => {
    it('maps a successful charge', () => {
      const event = gateway.parseWebhook({
        event: 'charge.completed',
        data: { id: 99, tx_ref: 'pay-123', status: 'successful' },
      });
      expect(event).toEqual({
        txRef: 'pay-123',
        providerRef: '99',
        status: PaymentStatus.SUCCESSFUL,
      });
    });
    it('maps a failed charge', () => {
      const event = gateway.parseWebhook({
        data: { id: 7, tx_ref: 'pay-7', status: 'failed' },
      });
      expect(event?.status).toBe(PaymentStatus.FAILED);
    });
    it('returns null when tx_ref is absent', () => {
      expect(gateway.parseWebhook({ data: { id: 1, status: 'successful' } })).toBeNull();
    });
  });
});
