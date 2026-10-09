import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  type Paginated,
  type PaymentInitiation,
  PaymentPurpose,
  PropertyStatus,
  type RentalAgreementResponse,
  RentalAgreementStatus,
  UserRole,
} from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { mapRentalAgreement } from '../common/mappers';
import {
  PAYMENT_SUCCEEDED,
  type PaymentSucceededEvent,
} from '../payments/payment-events';
import { PaymentsService } from '../payments/payments.service';
import { CreateRentalDto } from './dto/create-rental.dto';
import { PayRentDto } from './dto/pay-rent.dto';
import { RentalsRepository } from './rentals.repository';

function addMonths(date: Date, n: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, date.getUTCDate()),
  );
}

@Injectable()
export class RentalsService {
  private readonly logger = new Logger(RentalsService.name);

  constructor(
    private readonly repo: RentalsRepository,
    private readonly payments: PaymentsService,
  ) {}

  async create(
    user: AuthenticatedUser,
    dto: CreateRentalDto,
  ): Promise<RentalAgreementResponse> {
    const listing = await this.repo.findActiveRentListing(dto.listingId);
    if (!listing) throw new NotFoundException('Rent listing not found');
    if (listing.property.ownerId === user.id) {
      throw new BadRequestException('You cannot rent your own property');
    }

    // A yearly listing price is the annual rent; bill it monthly.
    const monthlyRent =
      listing.rentPeriod === 'yearly'
        ? listing.price.div(12).toDecimalPlaces(2)
        : listing.price;

    const startDate = new Date(`${dto.startDate}T00:00:00.000Z`);
    const endDate = dto.months ? addMonths(startDate, dto.months) : null;

    const agreement = await this.repo.create({
      listingId: listing.id,
      tenantId: user.id,
      startDate,
      endDate,
      monthlyRent,
      currency: listing.currency,
    });
    // Deliberately no hold here: a pending, unpaid agreement must NOT lock the
    // property, or one tenant could block everyone else without paying. The
    // property is only taken (→ rented) once the first rent actually settles.
    this.logger.log(`Rental agreement ${agreement.id} created (pending)`);
    return mapRentalAgreement(agreement);
  }

  async listMine(
    user: AuthenticatedUser,
    page: number,
    pageSize: number,
  ): Promise<Paginated<RentalAgreementResponse>> {
    const [rows, total] = await this.repo.listByTenant(
      user.id,
      (page - 1) * pageSize,
      pageSize,
    );
    return { items: rows.map(mapRentalAgreement), total, page, pageSize };
  }

  async listIncoming(
    user: AuthenticatedUser,
    page: number,
    pageSize: number,
  ): Promise<Paginated<RentalAgreementResponse>> {
    const [rows, total] = await this.repo.listByOwner(
      user.id,
      (page - 1) * pageSize,
      pageSize,
    );
    return { items: rows.map(mapRentalAgreement), total, page, pageSize };
  }

  // Pay one month's rent. The agreement activates when the first payment
  // settles (see onPaymentSucceeded).
  async payRent(
    user: AuthenticatedUser,
    agreementId: string,
    dto: PayRentDto,
  ): Promise<PaymentInitiation> {
    const agreement = await this.repo.findById(agreementId);
    if (!agreement) throw new NotFoundException('Rental agreement not found');
    if (agreement.tenantId !== user.id) {
      throw new ForbiddenException('This agreement is not yours');
    }
    if (
      agreement.status === RentalAgreementStatus.ENDED ||
      agreement.status === RentalAgreementStatus.TERMINATED
    ) {
      throw new BadRequestException('This agreement is no longer active');
    }
    // First payment on a still-pending agreement: make sure another tenant/buyer
    // hasn't already taken the property. (Ongoing rent on an active agreement is
    // always allowed — the payer already holds it.)
    if (agreement.status === RentalAgreementStatus.PENDING) {
      const propertyStatus = await this.repo.propertyStatusForListing(agreement.listingId);
      if (propertyStatus !== PropertyStatus.ACTIVE) {
        throw new BadRequestException('This property is no longer available');
      }
    }
    return this.payments.initiate(user, {
      purpose: PaymentPurpose.RENT,
      referenceId: agreement.id,
      amount: agreement.monthlyRent.toNumber(),
      currency: agreement.currency,
      provider: dto.provider,
      phone: dto.phone,
      redirectUrl: dto.redirectUrl,
    });
  }

  // End an agreement early. Allowed for the tenant, the listing owner, or admin.
  async terminate(
    user: AuthenticatedUser,
    agreementId: string,
  ): Promise<RentalAgreementResponse> {
    const agreement = await this.repo.findWithOwner(agreementId);
    if (!agreement) throw new NotFoundException('Rental agreement not found');
    const isParty =
      user.role === UserRole.ADMIN ||
      agreement.tenantId === user.id ||
      agreement.listing.property.ownerId === user.id;
    if (!isParty) throw new ForbiddenException('This agreement is not yours');
    if (
      agreement.status === RentalAgreementStatus.ENDED ||
      agreement.status === RentalAgreementStatus.TERMINATED
    ) {
      throw new BadRequestException('This agreement is already closed');
    }
    await this.repo.updateStatus(agreement.id, RentalAgreementStatus.TERMINATED);
    // Put the property back on the market.
    await this.repo.transitionPropertyStatus(
      agreement.listingId,
      [PropertyStatus.RESERVED, PropertyStatus.RENTED],
      PropertyStatus.ACTIVE,
    );
    const fresh = (await this.repo.findById(agreement.id))!;
    return mapRentalAgreement(fresh);
  }

  /** A settled rent payment activates a still-pending agreement. */
  @OnEvent(PAYMENT_SUCCEEDED)
  async onPaymentSucceeded(event: PaymentSucceededEvent): Promise<void> {
    if (event.purpose !== PaymentPurpose.RENT || !event.referenceId) return;
    try {
      const agreement = await this.repo.findById(event.referenceId);
      if (agreement && agreement.status === RentalAgreementStatus.PENDING) {
        await this.repo.updateStatus(agreement.id, RentalAgreementStatus.ACTIVE);
        // The property is now taken.
        await this.repo.transitionPropertyStatus(
          agreement.listingId,
          [PropertyStatus.ACTIVE, PropertyStatus.RESERVED],
          PropertyStatus.RENTED,
        );
        this.logger.log(`Rental agreement ${agreement.id} activated by rent payment`);
      }
    } catch (err) {
      this.logger.error(
        `Failed activating agreement for payment ${event.paymentId}: ${String(err)}`,
      );
    }
  }
}
