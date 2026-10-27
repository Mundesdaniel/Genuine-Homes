import { Injectable } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import type { Booking } from '@prisma/client';
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

  async findActiveListingForBooking(listingId: string): Promise<ListingForBooking | null> {
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

  // Viewing requests the user handles: ones on properties they own, plus ones on
  // properties where they're an assigned agent (a manager's apartment, e.g.).
  listByOwner(
    userId: string,
    skip: number,
    take: number,
  ): Promise<[BookingWithRelations[], number]> {
    const where: Prisma.BookingWhereInput = {
      OR: [{ ownerId: userId }, { property: { assignments: { some: { agentId: userId } } } }],
    };
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

  /**
   * Has this buyer completed a viewing of the listing's property? A viewing is
   * "completed" once the owner has accepted it and its scheduled time has passed.
   * Keyed on the property (not the listing) so viewing the house counts whichever
   * of its listings — sale, rent, installment — the buyer ends up paying through.
   */
  async hasCompletedViewing(buyerId: string, listingId: string): Promise<boolean> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { propertyId: true },
    });
    if (!listing) return false;
    const count = await this.prisma.booking.count({
      where: {
        buyerId,
        propertyId: listing.propertyId,
        status: BookingStatus.accepted,
        // Completed either by an explicit confirmation or, failing that, once
        // the scheduled time has simply passed.
        OR: [{ viewedAt: { not: null } }, { scheduledAt: { lte: new Date() } }],
      },
    });
    return count > 0;
  }

  /** The buyer's current (non-terminal) viewing of this listing's property, if
   *  any — a pending request or an accepted booking. Drives both the
   *  no-double-booking guard and what the listing page offers (wait vs confirm). */
  async findActiveViewing(
    buyerId: string,
    listingId: string,
  ): Promise<{ id: string; status: BookingStatus } | null> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { propertyId: true },
    });
    if (!listing) return null;
    const booking = await this.prisma.booking.findFirst({
      where: {
        buyerId,
        propertyId: listing.propertyId,
        status: { in: [BookingStatus.pending, BookingStatus.accepted] },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    });
    return booking ?? null;
  }

  // Stamp a booking as viewed (the confirmation that the viewing happened).
  markViewed(id: string): Promise<BookingWithRelations> {
    return this.prisma.booking.update({
      where: { id },
      data: { viewedAt: new Date() },
      include: bookingInclude,
    });
  }

  // Narrowed lookup for authorization checks (no relations needed).
  findOwnership(
    id: string,
  ): Promise<Pick<Booking, 'id' | 'buyerId' | 'ownerId' | 'propertyId' | 'status'> | null> {
    return this.prisma.booking.findUnique({
      where: { id },
      select: { id: true, buyerId: true, ownerId: true, propertyId: true, status: true },
    });
  }

  // Whether a user is an agent assigned to a property (can handle its viewings).
  async isAssignedAgent(propertyId: string, userId: string): Promise<boolean> {
    const count = await this.prisma.propertyAssignment.count({
      where: { propertyId, agentId: userId },
    });
    return count > 0;
  }

  // Ids of agents assigned to a property — notified alongside the owner.
  async assignedAgentIds(propertyId: string): Promise<string[]> {
    const rows = await this.prisma.propertyAssignment.findMany({
      where: { propertyId },
      select: { agentId: true },
    });
    return rows.map((r) => r.agentId);
  }
}
