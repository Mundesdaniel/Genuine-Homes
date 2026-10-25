import { Injectable } from '@nestjs/common';
import { Prisma, type ShortLetAvailabilityBlock, type ShortLetBooking } from '@prisma/client';
import type { ShortLetBookingStatus } from '@genuine-homes/shared';
import { PrismaService } from '../prisma/prisma.service';

const agentListingSelect = {
  id: true,
  propertyId: true,
  price: true,
  currency: true,
  isShortLet: true,
  property: { select: { title: true } },
} satisfies Prisma.ListingSelect;

export type AgentListing = Prisma.ListingGetPayload<{ select: typeof agentListingSelect }>;

@Injectable()
export class ShortLetRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Every listing the agent owns (via the property), newest first. */
  findAgentListings(ownerId: string): Promise<AgentListing[]> {
    return this.prisma.listing.findMany({
      where: { deletedAt: null, property: { ownerId, deletedAt: null } },
      select: agentListingSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Confirms a listing belongs to the agent (returns it, or null). */
  findAgentListing(listingId: string, ownerId: string): Promise<AgentListing | null> {
    return this.prisma.listing.findFirst({
      where: { id: listingId, deletedAt: null, property: { ownerId, deletedAt: null } },
      select: agentListingSelect,
    });
  }

  bookingsForListings(listingIds: string[]): Promise<ShortLetBooking[]> {
    if (listingIds.length === 0) return Promise.resolve([]);
    return this.prisma.shortLetBooking.findMany({
      where: { listingId: { in: listingIds } },
      orderBy: { checkIn: 'asc' },
    });
  }

  blocksForListings(listingIds: string[]): Promise<ShortLetAvailabilityBlock[]> {
    if (listingIds.length === 0) return Promise.resolve([]);
    return this.prisma.shortLetAvailabilityBlock.findMany({
      where: { listingId: { in: listingIds } },
      orderBy: { startDate: 'asc' },
    });
  }

  /** Flag a listing as short-let (idempotent) when the agent records activity. */
  async markShortLet(listingId: string): Promise<void> {
    await this.prisma.listing.update({
      where: { id: listingId },
      data: { isShortLet: true },
    });
  }

  createBooking(data: {
    listingId: string;
    checkIn: Date;
    checkOut: Date;
    amount: number;
    currency: string;
    guestName: string | null;
    status: ShortLetBookingStatus;
  }): Promise<ShortLetBooking> {
    return this.prisma.shortLetBooking.create({ data });
  }

  createBlock(data: {
    listingId: string;
    startDate: Date;
    endDate: Date;
    note: string | null;
  }): Promise<ShortLetAvailabilityBlock> {
    return this.prisma.shortLetAvailabilityBlock.create({ data });
  }
}
