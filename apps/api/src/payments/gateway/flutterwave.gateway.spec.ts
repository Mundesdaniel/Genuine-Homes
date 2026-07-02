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

  describe('verifyTransaction', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('maps a confirmed successful transaction', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          data: { tx_ref: 'pay-123', status: 'successful', amount: 500000, currency: 'UGX' },
        }),
      } as unknown as Response);

      const verified = await gateway.verifyTransaction('99');
      expect(fetch).toHaveBeenCalledWith(
        'https://api.flutterwave.com/v3/transactions/99/verify',
        expect.objectContaining({
          headers: { authorization: 'Bearer FLWSECK_TEST-xxxx' },
        }),
      );
      expect(verified).toEqual({
        txRef: 'pay-123',
        status: PaymentStatus.SUCCESSFUL,
        amount: 500000,
        currency: 'UGX',
      });
    });

    it('returns null on an API error', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ status: 'error' }),
      } as unknown as Response);
      await expect(gateway.verifyTransaction('99')).resolves.toBeNull();
    });
  });
});
