import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Payment } from '@prisma/client';
import { PaymentProvider, PaymentStatus, UserRole } from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { PaymentsService } from './payments.service';
import type { PaymentsRepository } from './payments.repository';
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
    provider: 'cash',
    providerRef: null,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as unknown as Payment;

// Cash-only: online gateways are disabled, so the DTO only ever carries `cash`.
const dto: InitiatePaymentDto = {
  purpose: 'deposit',
  amount: 1_500_000,
  provider: PaymentProvider.CASH,
} as InitiatePaymentDto;

describe('PaymentsService', () => {
  let repo: jest.Mocked<PaymentsRepository>;
  let events: { emit: jest.Mock };
  let audit: { record: jest.Mock };
  let service: PaymentsService;

  beforeEach(() => {
    repo = {
      create: jest.fn().mockResolvedValue(fakePayment()),
      findById: jest.fn().mockResolvedValue(fakePayment()),
      listByUser: jest.fn().mockResolvedValue([[fakePayment()], 1]),
      settle: jest.fn().mockResolvedValue(true),
      findPaymentOwner: jest.fn().mockResolvedValue(owner.id),
      findUser: jest.fn().mockResolvedValue({
        fullName: 'David Okello',
        email: null,
        phone: '+256700000003',
      }),
    } as unknown as jest.Mocked<PaymentsRepository>;
    events = { emit: jest.fn() };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new PaymentsService(
      repo,
      events as unknown as import('@nestjs/event-emitter').EventEmitter2,
      audit as unknown as import('../audit/audit.service').AuditService,
    );
  });

  describe('initiate', () => {
    it('creates a pending cash row and returns no redirect URL', async () => {
      const result = await service.initiate(owner, dto);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: owner.id,
          purpose: 'deposit',
          amount: 1_500_000,
          provider: PaymentProvider.CASH,
        }),
      );
      expect(result.redirectUrl).toBeNull();
      expect(result.payment.id).toBe('pay-1');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'payment.cash_pending', entityId: 'pay-1' }),
      );
    });

    it('404s when the account does not exist', async () => {
      repo.findUser.mockResolvedValue(null);
      await expect(service.initiate(owner, dto)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('confirmCash', () => {
    it('settles a pending cash payment and announces success (owner)', async () => {
      const res = await service.confirmCash(owner, 'pay-1');
      expect(repo.settle).toHaveBeenCalledWith(
        'pay-1',
        'cash_pay-1',
        PaymentStatus.SUCCESSFUL,
      );
      expect(events.emit).toHaveBeenCalled();
      expect(res.id).toBe('pay-1');
    });

    it('lets an admin confirm without owning the property', async () => {
      await expect(service.confirmCash(admin, 'pay-1')).resolves.toBeDefined();
      expect(repo.findPaymentOwner).not.toHaveBeenCalled();
    });

    it('forbids a non-owner, non-admin from confirming', async () => {
      repo.findPaymentOwner.mockResolvedValue('someone-else');
      await expect(service.confirmCash(owner, 'pay-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repo.settle).not.toHaveBeenCalled();
    });

    it('rejects a payment that is not cash', async () => {
      repo.findById.mockResolvedValue(fakePayment({ provider: 'mtn_momo' }));
      await expect(service.confirmCash(owner, 'pay-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects a payment that is already settled', async () => {
      repo.findById.mockResolvedValue(fakePayment({ status: 'successful' }));
      await expect(service.confirmCash(owner, 'pay-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('404s when the payment does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.confirmCash(owner, 'pay-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
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

    it("forbids reading someone else's payment", async () => {
      repo.findById.mockResolvedValue(fakePayment({ userId: 'someone-else' }));
      await expect(service.getOne(owner, 'pay-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('404s when missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.getOne(owner, 'pay-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
