import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RentalAgreement } from '@prisma/client';
import { PaymentPurpose, RentalAgreementStatus, UserRole } from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import type { PaymentsService } from '../payments/payments.service';
import type { RentListing, RentalsRepository } from './rentals.repository';
import { RentalsService } from './rentals.service';

const tenant: AuthenticatedUser = { id: 'tenant-1', role: UserRole.USER };
const owner: AuthenticatedUser = { id: 'owner-1', role: UserRole.LANDLORD };

const rentListing = (over: Partial<RentListing> = {}): RentListing =>
  ({
    id: 'listing-1',
    listingType: 'rent',
    price: new Prisma.Decimal('1200000'),
    currency: 'UGX',
    rentPeriod: 'monthly',
    isActive: true,
    deletedAt: null,
    property: { id: 'prop-1', ownerId: owner.id },
    ...over,
  }) as unknown as RentListing;

const agreement = (over: Partial<RentalAgreement> = {}): RentalAgreement =>
  ({
    id: 'agr-1',
    listingId: 'listing-1',
    tenantId: tenant.id,
    startDate: new Date('2026-07-01'),
    endDate: null,
    monthlyRent: new Prisma.Decimal('1200000'),
    currency: 'UGX',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as unknown as RentalAgreement;

describe('RentalsService', () => {
  let repo: jest.Mocked<RentalsRepository>;
  let payments: jest.Mocked<PaymentsService>;
  let service: RentalsService;

  beforeEach(() => {
    repo = {
      findActiveRentListing: jest.fn().mockResolvedValue(rentListing()),
      create: jest.fn().mockResolvedValue(agreement()),
      findById: jest.fn().mockResolvedValue(agreement()),
      findWithOwner: jest.fn(),
      listByTenant: jest.fn().mockResolvedValue([[agreement()], 1]),
      listByOwner: jest.fn().mockResolvedValue([[agreement()], 1]),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RentalsRepository>;
    payments = {
      initiate: jest.fn().mockResolvedValue({ payment: {}, redirectUrl: 'x' }),
    } as unknown as jest.Mocked<PaymentsService>;
    service = new RentalsService(repo, payments);
  });

  describe('create', () => {
    it('creates a pending agreement and bills a yearly listing monthly', async () => {
      repo.findActiveRentListing.mockResolvedValue(
        rentListing({ rentPeriod: 'yearly', price: new Prisma.Decimal('12000000') }),
      );
      await service.create(tenant, { listingId: 'listing-1', startDate: '2026-07-01' });
      const data = repo.create.mock.calls[0][0];
      expect(data.monthlyRent.toNumber()).toBe(1_000_000); // 12,000,000 / 12
    });

    it("rejects renting your own property", async () => {
      await expect(
        service.create(owner, { listingId: 'listing-1', startDate: '2026-07-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('404s for a missing/non-rent listing', async () => {
      repo.findActiveRentListing.mockResolvedValue(null);
      await expect(
        service.create(tenant, { listingId: 'x', startDate: '2026-07-01' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('payRent', () => {
    it('initiates a rent payment for the tenant', async () => {
      await service.payRent(tenant, 'agr-1', { provider: 'mtn_momo' });
      expect(payments.initiate).toHaveBeenCalledWith(
        tenant,
        expect.objectContaining({ purpose: PaymentPurpose.RENT, referenceId: 'agr-1', amount: 1_200_000 }),
      );
    });

    it("forbids paying someone else's agreement", async () => {
      await expect(
        service.payRent({ id: 'intruder', role: UserRole.USER }, 'agr-1', { provider: 'mtn_momo' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects paying a terminated agreement', async () => {
      repo.findById.mockResolvedValue(agreement({ status: 'terminated' }));
      await expect(
        service.payRent(tenant, 'agr-1', { provider: 'mtn_momo' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('onPaymentSucceeded', () => {
    it('activates a pending agreement when rent settles', async () => {
      await service.onPaymentSucceeded({
        paymentId: 'pay-1',
        userId: tenant.id,
        purpose: PaymentPurpose.RENT,
        referenceId: 'agr-1',
        amount: 1_200_000,
      });
      expect(repo.updateStatus).toHaveBeenCalledWith('agr-1', RentalAgreementStatus.ACTIVE);
    });

    it('ignores non-rent payments', async () => {
      await service.onPaymentSucceeded({
        paymentId: 'pay-2',
        userId: tenant.id,
        purpose: PaymentPurpose.DEPOSIT,
        referenceId: 'plan-1',
        amount: 100,
      });
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });
  });
});
