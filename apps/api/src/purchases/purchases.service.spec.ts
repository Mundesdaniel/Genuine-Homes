import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaymentPurpose, PropertyStatus, UserRole } from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import type { PaymentsService } from '../payments/payments.service';
import type { PurchasesRepository, SaleListing } from './purchases.repository';
import { PurchasesService } from './purchases.service';

const buyer: AuthenticatedUser = { id: 'buyer-1', role: UserRole.USER };
const OWNER_ID = 'owner-1';

const saleListing = (over: Partial<SaleListing> = {}): SaleListing =>
  ({
    id: 'listing-1',
    listingType: 'sale',
    price: new Prisma.Decimal('80000000'),
    currency: 'UGX',
    isActive: true,
    deletedAt: null,
    property: { id: 'prop-1', ownerId: OWNER_ID, status: 'active' },
    ...over,
  }) as unknown as SaleListing;

describe('PurchasesService', () => {
  let repo: jest.Mocked<PurchasesRepository>;
  let payments: jest.Mocked<PaymentsService>;
  let service: PurchasesService;

  beforeEach(() => {
    repo = {
      findActiveSaleListing: jest.fn().mockResolvedValue(saleListing()),
      transitionPropertyStatus: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PurchasesRepository>;
    payments = {
      initiate: jest.fn().mockResolvedValue({ payment: {}, redirectUrl: 'x' }),
    } as unknown as jest.Mocked<PaymentsService>;
    service = new PurchasesService(repo, payments);
  });

  describe('buy', () => {
    it('initiates a full-price purchase payment', async () => {
      await service.buy(buyer, 'listing-1', { provider: 'mtn_momo' });
      expect(payments.initiate).toHaveBeenCalledWith(
        buyer,
        expect.objectContaining({
          purpose: PaymentPurpose.PURCHASE,
          referenceId: 'listing-1',
          amount: 80_000_000,
        }),
      );
    });

    it('404s when the property is not available for sale', async () => {
      repo.findActiveSaleListing.mockResolvedValue(null);
      await expect(
        service.buy(buyer, 'listing-1', { provider: 'mtn_momo' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects buying your own property', async () => {
      await expect(
        service.buy(
          { id: OWNER_ID, role: UserRole.LANDLORD },
          'listing-1',
          { provider: 'mtn_momo' },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('onPaymentSucceeded', () => {
    it('marks the property sold when a purchase settles', async () => {
      await service.onPaymentSucceeded({
        paymentId: 'pay-1',
        userId: buyer.id,
        purpose: PaymentPurpose.PURCHASE,
        referenceId: 'listing-1',
        amount: 80_000_000,
      });
      expect(repo.transitionPropertyStatus).toHaveBeenCalledWith(
        'listing-1',
        [PropertyStatus.ACTIVE, PropertyStatus.RESERVED],
        PropertyStatus.SOLD,
      );
    });

    it('ignores non-purchase payments', async () => {
      await service.onPaymentSucceeded({
        paymentId: 'pay-2',
        userId: buyer.id,
        purpose: PaymentPurpose.RENT,
        referenceId: 'listing-1',
        amount: 100,
      });
      expect(repo.transitionPropertyStatus).not.toHaveBeenCalled();
    });
  });
});
