import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Listing, Property, RentalAgreement } from '@prisma/client';
import type { RentalAgreementStatus } from '@genuine-homes/shared';
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

  findActiveRentListing(id: string): Promise<RentListing | null> {
    return this.prisma.listing.findFirst({
      where: { id, deletedAt: null, isActive: true, listingType: 'rent' },
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
}
