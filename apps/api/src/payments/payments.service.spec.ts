import {
  BadGatewayException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Payment } from '@prisma/client';
import { PaymentStatus, UserRole } from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { PaymentsService } from './payments.service';
import type { PaymentsRepository } from './payments.repository';
import type {
  PaymentGateway,
  WebhookEvent,
} from './gateway/payment-gateway.interface';
import type { InitiatePaymentDto } from './dto/initiate-payment.dto';

const owner: AuthenticatedUser = { id: 'user-1', role: UserRole.USER };
const admin: AuthenticatedUser = { id: 'admin-1', role: UserRole.ADMIN };

const fakePayment = (over: Partial<Payment> = {}): Payment =>
  ({
    id: 'pay-1',
    userId: owner.id,
    purpose: 'deposit',
    referenceId: null,
    amount: new Prisma.Decimal('1500000'),
    currency: 'UGX',
    provider: 'mtn_momo',
    providerRef: null,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as unknown as Payment;

// Configurable in-test gateway.
class FakeGateway implements PaymentGateway {
  readonly name = 'fake';
  signatureOk = true;
  event: WebhookEvent | null = {
    txRef: 'pay-1',
    providerRef: 'flw_1',
    status: PaymentStatus.SUCCESSFUL,
  };
  throwOnInitiate = false;
  async initiate() {
    if (this.throwOnInitiate) throw new Error('gateway down');
    return { providerRef: null, redirectUrl: 'https://checkout.test/pay-1' };
  }
  verifySignature() {
    return this.signatureOk;
  }
  parseWebhook() {
    return this.event;
  }
}

const dto: InitiatePaymentDto = {
  purpose: 'deposit',
  amount: 1_500_000,
  provider: 'mtn_momo',
} as InitiatePaymentDto;

describe('PaymentsService', () => {
  let repo: jest.Mocked<PaymentsRepository>;
  let gateway: FakeGateway;
  let service: PaymentsService;

  beforeEach(() => {
    repo = {
      create: jest.fn().mockResolvedValue(fakePayment()),
      findById: jest.fn().mockResolvedValue(fakePayment()),
      listByUser: jest.fn().mockResolvedValue([[fakePayment()], 1]),
      setProviderRef: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
      settle: jest.fn().mockResolvedValue(true),
      findUser: jest.fn().mockResolvedValue({
        fullName: 'David Okello',
        email: null,
        phone: '+256700000003',
      }),
    } as unknown as jest.Mocked<PaymentsRepository>;
    gateway = new FakeGateway();
    const events = { emit: jest.fn() } as unknown as import('@nestjs/event-emitter').EventEmitter2;
    const audit = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as import('../audit/audit.service').AuditService;
    service = new PaymentsService(repo, gateway, events, audit);
  });

  describe('initiate', () => {
    it('creates a pending ledger row and returns the checkout URL', async () => {
      const result = await service.initiate(owner, dto);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: owner.id, purpose: 'deposit', amount: 1_500_000 }),
      );
      expect(result.redirectUrl).toBe('https://checkout.test/pay-1');
      expect(result.payment.id).toBe('pay-1');
    });

    it('marks the payment failed and throws if the gateway errors', async () => {
      gateway.throwOnInitiate = true;
      await expect(service.initiate(owner, dto)).rejects.toBeInstanceOf(
        BadGatewayException,
      );
      expect(repo.markFailed).toHaveBeenCalledWith('pay-1');
    });

    it('404s when the account does not exist', async () => {
      repo.findUser.mockResolvedValue(null);
      await expect(service.initiate(owner, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('handleWebhook', () => {
    it('rejects an invalid signature', async () => {
      gateway.signatureOk = false;
      await expect(service.handleWebhook({}, {})).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(repo.settle).not.toHaveBeenCalled();
    });

    it('settles a pending payment from a valid webhook', async () => {
      const res = await service.handleWebhook({ 'verif-hash': 'x' }, {});
      expect(repo.settle).toHaveBeenCalledWith('pay-1', 'flw_1', PaymentStatus.SUCCESSFUL);
      expect(res).toEqual({ received: true });
    });

    it('is idempotent — a duplicate webhook is a no-op', async () => {
      repo.settle.mockResolvedValue(false); // already settled
      const res = await service.handleWebhook({ 'verif-hash': 'x' }, {});
      expect(res).toEqual({ received: true });
    });

    it('ignores an unrecognised payload', async () => {
      gateway.event = null;
      const res = await service.handleWebhook({ 'verif-hash': 'x' }, {});
      expect(repo.settle).not.toHaveBeenCalled();
      expect(res).toEqual({ received: true });
    });
  });

  describe('getOne', () => {
    it('returns the payment to its owner', async () => {
      const res = await service.getOne(owner, 'pay-1');
      expect(res.id).toBe('pay-1');
      expect(res.amount).toBe(1_500_000);
    });

    it('lets an admin read any payment', async () => {
      await expect(service.getOne(admin, 'pay-1')).resolves.toBeDefined();
    });

    it('forbids reading someone else\'s payment', async () => {
      repo.findById.mockResolvedValue(fakePayment({ userId: 'someone-else' }));
      await expect(service.getOne(owner, 'pay-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('404s when missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.getOne(owner, 'pay-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
