import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  type PaymentInitiation,
  PaymentPurpose,
  PropertyStatus,
} from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import {
  PAYMENT_SUCCEEDED,
  type PaymentSucceededEvent,
} from '../payments/payment-events';
import { PaymentsService } from '../payments/payments.service';
import { BuyDto } from './dto/buy.dto';
import { PurchasesRepository } from './purchases.repository';

/**
 * Outright purchase: pay a property's full sale price in a single payment. The
 * property is marked `sold` once the payment settles (see onPaymentSucceeded) —
 * the alternative to an installment plan on the same for-sale listing.
 */
@Injectable()
export class PurchasesService {
  private readonly logger = new Logger(PurchasesService.name);

  constructor(
    private readonly repo: PurchasesRepository,
    private readonly payments: PaymentsService,
  ) {}

  async buy(
    user: AuthenticatedUser,
    listingId: string,
    dto: BuyDto,
  ): Promise<PaymentInitiation> {
    const listing = await this.repo.findActiveSaleListing(listingId);
    if (!listing) {
      throw new NotFoundException('This property is not available for sale');
    }
    if (listing.property.ownerId === user.id) {
      throw new BadRequestException('You cannot buy your own property');
    }
    return this.payments.initiate(user, {
      purpose: PaymentPurpose.PURCHASE,
      referenceId: listing.id,
      amount: listing.price.toNumber(),
      currency: listing.currency,
      provider: dto.provider,
      phone: dto.phone,
      redirectUrl: dto.redirectUrl,
    });
  }

  /** A settled purchase payment marks the property sold. */
  @OnEvent(PAYMENT_SUCCEEDED)
  async onPaymentSucceeded(event: PaymentSucceededEvent): Promise<void> {
    if (event.purpose !== PaymentPurpose.PURCHASE || !event.referenceId) return;
    try {
      await this.repo.transitionPropertyStatus(
        event.referenceId,
        [PropertyStatus.ACTIVE, PropertyStatus.RESERVED],
        PropertyStatus.SOLD,
      );
      this.logger.log(`Property sold via purchase (listing ${event.referenceId})`);
    } catch (err) {
      this.logger.error(
        `Failed marking property sold for payment ${event.paymentId}: ${String(err)}`,
      );
    }
  }
}
