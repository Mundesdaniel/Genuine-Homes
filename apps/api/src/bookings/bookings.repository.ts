import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Booking, BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Everything mapBooking needs: the property title + a slim buyer profile.
const bookingInclude = {
  property: { select: { title: true } },
  buyer: { select: { id: true, fullName: true, phone: true } },
} satisfies Prisma.BookingInclude;

export type BookingWithRelations = Prisma.BookingGetPayload<{
  include: typeof bookingInclude;
}>;

// The listing (with the owner + property status) a viewing is requested against.
export type ListingForBooking = {
  id: string;
  property: { id: string; ownerId: string; title: string; status: string };
};

@Injectable()
export class BookingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveListingForBooking(
    listingId: string,
  ): Promise<ListingForBooking | null> {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, deletedAt: null, isActive: true, property: { deletedAt: null } },
      select: {
        id: true,
        property: { select: { id: true, ownerId: true, title: true, status: true } },
      },
    });
    return listing;
  }

  create(data: {
    listingId: string;
    propertyId: string;
    buyerId: string;
    ownerId: string;
    scheduledAt: Date;
    message: string | null;
  }): Promise<BookingWithRelations> {
    return this.prisma.booking.create({ data, include: bookingInclude });
  }

  findByIdWithRelations(id: string): Promise<BookingWithRelations | null> {
    return this.prisma.booking.findUnique({ where: { id }, include: bookingInclude });
  }

  updateStatus(id: string, status: BookingStatus): Promise<BookingWithRelations> {
    return this.prisma.booking.update({
      where: { id },
      data: { status },
      include: bookingInclude,
    });
  }

  listByBuyer(
    buyerId: string,
    skip: number,
    take: number,
  ): Promise<[BookingWithRelations[], number]> {
    const where: Prisma.BookingWhereInput = { buyerId };
    return this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        include: bookingInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.booking.count({ where }),
    ]);
  }

  listByOwner(
    ownerId: string,
    skip: number,
    take: number,
  ): Promise<[BookingWithRelations[], number]> {
    const where: Prisma.BookingWhereInput = { ownerId };
    return this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        include: bookingInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.booking.count({ where }),
    ]);
  }

  // Narrowed lookup for authorization checks (no relations needed).
  findOwnership(
    id: string,
  ): Promise<Pick<Booking, 'id' | 'buyerId' | 'ownerId' | 'status'> | null> {
    return this.prisma.booking.findUnique({
      where: { id },
      select: { id: true, buyerId: true, ownerId: true, status: true },
    });
  }
}
