import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Listing, Property, RentalAgreement } from '@prisma/client';
import type { PropertyStatus, RentalAgreementStatus } from '@genuine-homes/shared';
import { PrismaService } from '../prisma/prisma.service';

export type RentListing = Listing & {
  property: Pick<Property, 'id' | 'ownerId'>;
};

export type AgreementWithOwner = RentalAgreement & {
  listing: { property: Pick<Property, 'ownerId'> };
};

export interface RentalCreateData {
  listingId: string;
  tenantId: string;
  startDate: Date;
  endDate: Date | null;
  monthlyRent: Prisma.Decimal;
  currency: string;
}

@Injectable()
export class RentalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Only an active property is rentable — a reserved/rented/sold one is already
  // taken, so its listings must not accept a new agreement.
  findActiveRentListing(id: string): Promise<RentListing | null> {
    return this.prisma.listing.findFirst({
      where: {
        id,
        deletedAt: null,
        isActive: true,
        listingType: 'rent',
        property: { status: 'active' },
      },
      include: { property: { select: { id: true, ownerId: true } } },
    });
  }

  create(data: RentalCreateData): Promise<RentalAgreement> {
    return this.prisma.rentalAgreement.create({ data });
  }

  findById(id: string): Promise<RentalAgreement | null> {
    return this.prisma.rentalAgreement.findUnique({ where: { id } });
  }

  // Agreement plus the owning seller — for ownership checks (terminate, incoming).
  findWithOwner(id: string): Promise<AgreementWithOwner | null> {
    return this.prisma.rentalAgreement.findUnique({
      where: { id },
      include: { listing: { select: { property: { select: { ownerId: true } } } } },
    });
  }

  async listByTenant(
    tenantId: string,
    skip: number,
    take: number,
  ): Promise<[RentalAgreement[], number]> {
    const where: Prisma.RentalAgreementWhereInput = { tenantId };
    return this.prisma.$transaction([
      this.prisma.rentalAgreement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.rentalAgreement.count({ where }),
    ]);
  }

  // Agreements on listings owned by `ownerId` (landlord/agent inbox).
  async listByOwner(
    ownerId: string,
    skip: number,
    take: number,
  ): Promise<[RentalAgreement[], number]> {
    const where: Prisma.RentalAgreementWhereInput = {
      listing: { property: { ownerId } },
    };
    return this.prisma.$transaction([
      this.prisma.rentalAgreement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.rentalAgreement.count({ where }),
    ]);
  }

  async updateStatus(id: string, status: RentalAgreementStatus): Promise<void> {
    await this.prisma.rentalAgreement.update({ where: { id }, data: { status } });
  }

  // Current status of the property behind a listing — for the first-payment
  // availability guard (a house another tenant already took can't be rented).
  async propertyStatusForListing(listingId: string): Promise<string | null> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { property: { select: { status: true } } },
    });
    return listing?.property.status ?? null;
  }

  // Move the property behind a listing between lifecycle states, but only from
  // an expected source status. The `status: { in: from }` guard makes the write
  // a no-op if the property has since moved on (e.g. a manual override), so
  // automatic and by-hand status changes can't clobber each other.
  async transitionPropertyStatus(
    listingId: string,
    from: PropertyStatus[],
    to: PropertyStatus,
  ): Promise<void> {
    await this.prisma.property.updateMany({
      where: { status: { in: from }, listings: { some: { id: listingId } } },
      data: { status: to },
    });
  }
}
