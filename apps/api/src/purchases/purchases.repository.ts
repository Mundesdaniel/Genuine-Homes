import { Injectable } from '@nestjs/common';
import type { Listing, Property } from '@prisma/client';
import type { PropertyStatus } from '@genuine-homes/shared';
import { PrismaService } from '../prisma/prisma.service';

export type SaleListing = Listing & {
  property: Pick<Property, 'id' | 'ownerId' | 'status'>;
};

@Injectable()
export class PurchasesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // A sale listing is buyable outright only while its property is still active
  // (a reserved/sold one is already taken).
  findActiveSaleListing(id: string): Promise<SaleListing | null> {
    return this.prisma.listing.findFirst({
      where: {
        id,
        deletedAt: null,
        isActive: true,
        listingType: 'sale',
        property: { status: 'active' },
      },
      include: { property: { select: { id: true, ownerId: true, status: true } } },
    });
  }

  // Guarded transition (see rentals/installments repositories for the rationale):
  // only moves the property when it is in an expected source status.
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
