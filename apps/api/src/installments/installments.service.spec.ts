import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import type { InstallmentPayment, InstallmentPlan, Listing } from '@prisma/client';
import { InstallmentPlanStatus, PaymentPurpose, UserRole } from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import {
  INSTALLMENT_DUE_SOON,
  INSTALLMENT_OVERDUE,
  PLAN_DEFAULTED,
  PLAN_REINSTATED,
} from './installment-events';
import { InstallmentsService } from './installments.service';
import type {
  InstallmentsRepository,
  PlanWithSchedule,
  ScheduledPaymentWithPlan,
  ScheduleItem,
} from './installments.repository';
import type { PaymentsService } from '../payments/payments.service';
import type { CreatePlanDto } from './dto/create-plan.dto';

const buyer: AuthenticatedUser = { id: 'buyer-1', role: UserRole.USER };
const stranger: AuthenticatedUser = { id: 'other', role: UserRole.USER };
const admin: AuthenticatedUser = { id: 'admin-1', role: UserRole.ADMIN };

const listing = (): Listing =>
  ({
    id: 'listing-1',
    price: new Prisma.Decimal('80000000'),
    currency: 'UGX',
    listingType: 'installment',
    minDepositPercent: new Prisma.Decimal('20'),
    maxInstallmentMonths: 36,
    isActive: true,
    deletedAt: null,
  }) as unknown as Listing;

const plan = (over: Partial<InstallmentPlan> = {}): InstallmentPlan =>
  ({
    id: 'plan-1',
    listingId: 'listing-1',
    buyerId: buyer.id,
    totalPrice: new Prisma.Decimal('80000000'),
    depositAmount: new Prisma.Decimal('16000000'),
    months: 24,
    monthlyAmount: new Prisma.Decimal('2666666.66'),
    serviceFeePercent: new Prisma.Decimal('0'),
    currency: 'UGX',
    status: 'pending_deposit',
    nextDueDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as unknown as InstallmentPlan;

const planDetail = (over: Partial<InstallmentPlan> = {}): PlanWithSchedule =>
  ({ ...plan(over), payments: [] }) as unknown as PlanWithSchedule;

const scheduledPayment = (
  over: Partial<ScheduledPaymentWithPlan> = {},
): ScheduledPaymentWithPlan =>
  ({
    id: 'item-1',
    planId: 'plan-1',
    sequence: 3,
    amount: new Prisma.Decimal('2666666.66'),
    dueDate: new Date('2026-06-01'),
    status: 'upcoming',
    plan: { id: 'plan-1', buyerId: buyer.id, currency: 'UGX', status: 'active' },
    ...over,
  }) as unknown as ScheduledPaymentWithPlan;

describe('InstallmentsService', () => {
  let repo: jest.Mocked<InstallmentsRepository>;
  let payments: jest.Mocked<PaymentsService>;
  let events: jest.Mocked<EventEmitter2>;
  let audit: jest.Mocked<import('../audit/audit.service').AuditService>;
  let service: InstallmentsService;

  beforeEach(() => {
    repo = {
      findActiveInstallmentListing: jest.fn().mockResolvedValue(listing()),
      createPlanWithSchedule: jest.fn().mockResolvedValue('plan-1'),
      findPlanById: jest.fn().mockResolvedValue(plan()),
      findPlanDetail: jest.fn().mockResolvedValue(planDetail()),
      findPlansByBuyer: jest.fn().mockResolvedValue([[planDetail()], 1]),
      findInstallmentPayment: jest.fn(),
      updatePlanStatus: jest.fn().mockResolvedValue(undefined),
      setNextDueDate: jest.fn().mockResolvedValue(undefined),
      markInstallmentPaid: jest.fn().mockResolvedValue(undefined),
      scheduleProgress: jest.fn().mockResolvedValue({ nextDue: new Date(), allPaid: false }),
      findDueSoon: jest.fn().mockResolvedValue([]),
      findOverdue: jest.fn().mockResolvedValue([]),
      markPaymentsLate: jest.fn().mockResolvedValue(0),
      findLateBeyond: jest.fn().mockResolvedValue([]),
      markPaymentsMissed: jest.fn().mockResolvedValue(0),
      findDefaultEligible: jest.fn().mockResolvedValue([[], 0]),
      countMissed: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<InstallmentsRepository>;
    payments = {
      initiate: jest.fn().mockResolvedValue({ payment: {}, redirectUrl: 'x' }),
    } as unknown as jest.Mocked<PaymentsService>;
    events = { emit: jest.fn() } as unknown as jest.Mocked<EventEmitter2>;
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<import('../audit/audit.service').AuditService>;
    service = new InstallmentsService(repo, payments, events, audit);
  });

  const dto = (over: Partial<CreatePlanDto> = {}): CreatePlanDto =>
    ({ listingId: 'listing-1', depositPercent: 20, months: 24, ...over }) as CreatePlanDto;

  describe('createPlan', () => {
    it('computes an exact deposit + schedule (last absorbs the remainder)', async () => {
      await service.createPlan(buyer, dto());
      const [planData, schedule] = repo.createPlanWithSchedule.mock.calls[0] as [
        { depositAmount: Prisma.Decimal },
        ScheduleItem[],
      ];
      expect(planData.depositAmount.toNumber()).toBe(16_000_000);
      expect(schedule).toHaveLength(24);
      const sum = schedule.reduce((s, x) => s + x.amount.toNumber(), 0);
      expect(Math.round(sum)).toBe(64_000_000); // total - deposit, to the cent
    });

    it('404s for a missing/non-installment listing', async () => {
      repo.findActiveInstallmentListing.mockResolvedValue(null);
      await expect(service.createPlan(buyer, dto())).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a deposit below the listing minimum', async () => {
      await expect(
        service.createPlan(buyer, dto({ depositPercent: 10 })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('payDeposit', () => {
    it('starts a deposit payment for a pending plan', async () => {
      await service.payDeposit(buyer, 'plan-1', {
        provider: 'mtn_momo',
        redirectUrl: 'https://app.test/payments/return',
      });
      expect(payments.initiate).toHaveBeenCalledWith(
        buyer,
        expect.objectContaining({
          purpose: PaymentPurpose.DEPOSIT,
          referenceId: 'plan-1',
          amount: 16_000_000,
          // The checkout return URL travels through to the gateway.
          redirectUrl: 'https://app.test/payments/return',
        }),
      );
    });

    it('rejects paying the deposit twice', async () => {
      repo.findPlanById.mockResolvedValue(plan({ status: 'active' }));
      await expect(
        service.payDeposit(buyer, 'plan-1', { provider: 'mtn_momo' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("forbids paying someone else's plan", async () => {
      await expect(
        service.payDeposit(stranger, 'plan-1', { provider: 'mtn_momo' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('onPaymentSucceeded', () => {
    it('activates a plan when its deposit settles', async () => {
      await service.onPaymentSucceeded({
        paymentId: 'pay-1',
        userId: buyer.id,
        purpose: PaymentPurpose.DEPOSIT,
        referenceId: 'plan-1',
        amount: 16_000_000,
      });
      expect(repo.updatePlanStatus).toHaveBeenCalledWith(
        'plan-1',
        InstallmentPlanStatus.ACTIVE,
        expect.any(Date),
      );
    });

    it('marks an installment paid and completes the plan when it was the last', async () => {
      repo.findInstallmentPayment.mockResolvedValue({
        id: 'item-1',
        planId: 'plan-1',
        status: 'upcoming',
      } as unknown as InstallmentPayment);
      repo.scheduleProgress.mockResolvedValue({ nextDue: null, allPaid: true });

      await service.onPaymentSucceeded({
        paymentId: 'pay-2',
        userId: buyer.id,
        purpose: PaymentPurpose.INSTALLMENT,
        referenceId: 'item-1',
        amount: 2_666_666.66,
      });

      expect(repo.markInstallmentPaid).toHaveBeenCalledWith('item-1', 'pay-2');
      expect(repo.updatePlanStatus).toHaveBeenCalledWith(
        'plan-1',
        InstallmentPlanStatus.COMPLETED,
        null,
      );
    });
  });

  describe('sweepOverdue', () => {
    it('emits a due-soon reminder for each upcoming payment in the window', async () => {
      repo.findDueSoon.mockResolvedValue([scheduledPayment({ id: 'item-due' })]);
      const result = await service.sweepOverdue(new Date('2026-05-30'));
      expect(events.emit).toHaveBeenCalledWith(
        INSTALLMENT_DUE_SOON,
        expect.objectContaining({ installmentId: 'item-due', buyerId: buyer.id }),
      );
      expect(result.dueSoon).toBe(1);
    });

    it('marks overdue payments late and emits an overdue reminder', async () => {
      repo.findOverdue.mockResolvedValue([scheduledPayment({ id: 'item-late' })]);
      repo.markPaymentsLate.mockResolvedValue(1);
      const result = await service.sweepOverdue(new Date('2026-07-01'));
      expect(repo.markPaymentsLate).toHaveBeenCalledWith(['item-late']);
      expect(events.emit).toHaveBeenCalledWith(
        INSTALLMENT_OVERDUE,
        expect.objectContaining({ installmentId: 'item-late' }),
      );
      expect(result.markedLate).toBe(1);
    });

    it('does nothing when nothing is due or overdue', async () => {
      const result = await service.sweepOverdue(new Date('2026-06-30'));
      expect(events.emit).not.toHaveBeenCalled();
      expect(result).toEqual({ dueSoon: 0, markedLate: 0, markedMissed: 0 });
    });

    it('escalates late payments past the grace period to missed', async () => {
      repo.findLateBeyond.mockResolvedValue([
        scheduledPayment({ id: 'item-old', status: 'late', dueDate: new Date('2026-05-01') }),
      ]);
      repo.markPaymentsMissed.mockResolvedValue(1);
      const result = await service.sweepOverdue(new Date('2026-07-01'));
      // Grace cutoff = today - DEFAULT_GRACE_DAYS (30) = 2026-06-01.
      expect(repo.findLateBeyond).toHaveBeenCalledWith(new Date(Date.UTC(2026, 5, 1)));
      expect(repo.markPaymentsMissed).toHaveBeenCalledWith(['item-old']);
      expect(result.markedMissed).toBe(1);
    });
  });

  describe('markDefaulted', () => {
    it('defaults an active plan, audits the decision and notifies the buyer', async () => {
      repo.findPlanById.mockResolvedValue(plan({ status: 'active' }));
      repo.countMissed.mockResolvedValue(4);
      repo.findPlanDetail.mockResolvedValue(planDetail({ status: 'defaulted' }));

      await service.markDefaulted(admin, 'plan-1', 'No payment since March');

      expect(repo.updatePlanStatus).toHaveBeenCalledWith(
        'plan-1',
        InstallmentPlanStatus.DEFAULTED,
        null,
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: admin.id,
          action: 'plan.defaulted',
          entityId: 'plan-1',
          metadata: expect.objectContaining({
            reason: 'No payment since March',
            missedCount: 4,
          }),
        }),
      );
      expect(events.emit).toHaveBeenCalledWith(
        PLAN_DEFAULTED,
        expect.objectContaining({ buyerId: buyer.id, planId: 'plan-1' }),
      );
    });

    it('rejects defaulting a plan that is not active', async () => {
      repo.findPlanById.mockResolvedValue(plan({ status: 'pending_deposit' }));
      await expect(
        service.markDefaulted(admin, 'plan-1', 'Some valid reason here'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.updatePlanStatus).not.toHaveBeenCalled();
    });

    it('404s for a missing plan', async () => {
      repo.findPlanById.mockResolvedValue(null);
      await expect(
        service.markDefaulted(admin, 'plan-x', 'Some valid reason here'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('reinstate', () => {
    it('returns a defaulted plan to active with a recomputed next due date', async () => {
      const nextDue = new Date('2026-08-01');
      repo.findPlanById.mockResolvedValue(plan({ status: 'defaulted' }));
      repo.scheduleProgress.mockResolvedValue({ nextDue, allPaid: false });
      repo.findPlanDetail.mockResolvedValue(planDetail({ status: 'active' }));

      await service.reinstate(admin, 'plan-1', 'Arrangement agreed');

      expect(repo.updatePlanStatus).toHaveBeenCalledWith(
        'plan-1',
        InstallmentPlanStatus.ACTIVE,
        nextDue,
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'plan.reinstated', entityId: 'plan-1' }),
      );
      expect(events.emit).toHaveBeenCalledWith(
        PLAN_REINSTATED,
        expect.objectContaining({ planId: 'plan-1' }),
      );
    });

    it('rejects reinstating a plan that is not defaulted', async () => {
      repo.findPlanById.mockResolvedValue(plan({ status: 'active' }));
      await expect(service.reinstate(admin, 'plan-1', null)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('listDefaultEligible', () => {
    it('maps eligible plans with buyer + missed count', async () => {
      repo.findDefaultEligible.mockResolvedValue([
        [
          {
            ...plan({ status: 'active' }),
            buyer: { id: buyer.id, fullName: 'Grace A.', phone: '+256700000001' },
            missedCount: 3,
          } as unknown as import('./installments.repository').DefaultEligiblePlan,
        ],
        1,
      ]);
      const result = await service.listDefaultEligible(1, 20);
      // Threshold comes from shared policy constants; page 1 → skip 0.
      expect(repo.findDefaultEligible).toHaveBeenCalledWith(3, 0, 20);
      expect(result.total).toBe(1);
      expect(result.items[0]).toMatchObject({
        missedCount: 3,
        buyer: { fullName: 'Grace A.' },
        plan: { id: 'plan-1', status: 'active' },
      });
    });
  });
});
