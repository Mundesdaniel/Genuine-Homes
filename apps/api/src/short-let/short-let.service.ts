import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DEFAULT_CURRENCY,
  ShortLetBookingStatus,
  type ShortLetAvailabilityBlockResponse,
  type ShortLetBookingResponse,
  type ShortLetDashboardResponse,
  type ShortLetListingSummary,
} from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import {
  mapShortLetAvailabilityBlock,
  mapShortLetBooking,
  nightsBetween,
} from '../common/mappers';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CreateAvailabilityBlockDto } from './dto/create-availability-block.dto';
import { CreateShortLetBookingDto } from './dto/create-short-let-booking.dto';
import { ShortLetRepository } from './short-let.repository';

const DAY_MS = 86_400_000;
const WINDOW_NIGHTS = 30; // occupancy is measured over the next 30 days

const addDay = (d: Date): Date => new Date(d.getTime() + DAY_MS);

/** Total nights that the given half-open [start, end) ranges cover within [winStart, winEnd). */
export function overlapNights(
  ranges: { start: Date; end: Date }[],
  winStart: Date,
  winEnd: Date,
): number {
  let nights = 0;
  for (const r of ranges) {
    const s = Math.max(r.start.getTime(), winStart.getTime());
    const e = Math.min(r.end.getTime(), winEnd.getTime());
    if (e > s) nights += Math.round((e - s) / DAY_MS);
  }
  return nights;
}

interface BookingLite {
  status: ShortLetBookingStatus;
  amount: number;
  checkIn: Date;
  checkOut: Date;
}
interface BlockLite {
  startDate: Date;
  endDate: Date;
}

export interface ListingMetrics {
  income: number;
  bookedNights: number;
  availableNights: number;
  occupancyRate: number;
}

/**
 * Income + occupancy for one listing over [winStart, winEnd). Cancelled
 * bookings are ignored. Occupancy = booked nights / available nights, where
 * available = window nights minus blocked nights (so blocking dates doesn't
 * count against you).
 */
export function computeListingMetrics(
  bookings: BookingLite[],
  blocks: BlockLite[],
  winStart: Date,
  winEnd: Date,
): ListingMetrics {
  const booked = bookings.filter((b) => b.status === ShortLetBookingStatus.BOOKED);
  const income = booked.reduce((sum, b) => sum + b.amount, 0);

  const windowNights = overlapNights([{ start: winStart, end: winEnd }], winStart, winEnd);
  const bookedNights = overlapNights(
    booked.map((b) => ({ start: b.checkIn, end: b.checkOut })),
    winStart,
    winEnd,
  );
  // Blocks store an inclusive end date, so extend by a day to a half-open range.
  const blockedNights = overlapNights(
    blocks.map((b) => ({ start: b.startDate, end: addDay(b.endDate) })),
    winStart,
    winEnd,
  );
  const availableNights = Math.max(0, windowNights - blockedNights);
  const occupancyRate = availableNights > 0 ? Math.min(1, bookedNights / availableNights) : 0;

  return { income, bookedNights, availableNights, occupancyRate };
}

@Injectable()
export class ShortLetService {
  constructor(
    private readonly repo: ShortLetRepository,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async dashboard(user: AuthenticatedUser): Promise<ShortLetDashboardResponse> {
    const sub = await this.subscriptions.getCurrentForUser(user.id);
    if (!sub) throw new ForbiddenException('No active subscription');

    const allListings = await this.repo.findAgentListings(user.id);
    const shortLet = allListings.filter((l) => l.isShortLet);
    const ids = shortLet.map((l) => l.id);
    const [bookings, blocks] = await Promise.all([
      this.repo.bookingsForListings(ids),
      this.repo.blocksForListings(ids),
    ]);

    // Occupancy window: the next 30 days from today (UTC midnight).
    const now = new Date();
    const winStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const winEnd = new Date(winStart.getTime() + WINDOW_NIGHTS * DAY_MS);

    const incomeByMonth = new Map<string, number>();
    let totalIncome = 0;
    let totalBookings = 0;
    let totalBookedNights = 0;
    let totalAvailableNights = 0;

    const listings: ShortLetListingSummary[] = shortLet.map((listing) => {
      const listingBookings = bookings.filter((b) => b.listingId === listing.id);
      const listingBlocks = blocks.filter((b) => b.listingId === listing.id);

      const metrics = computeListingMetrics(
        listingBookings.map((b) => ({
          status: b.status,
          amount: b.amount.toNumber(),
          checkIn: b.checkIn,
          checkOut: b.checkOut,
        })),
        listingBlocks.map((b) => ({ startDate: b.startDate, endDate: b.endDate })),
        winStart,
        winEnd,
      );

      totalIncome += metrics.income;
      totalBookedNights += metrics.bookedNights;
      totalAvailableNights += metrics.availableNights;

      for (const b of listingBookings) {
        if (b.status !== ShortLetBookingStatus.BOOKED) continue;
        totalBookings += 1;
        const month = b.checkIn.toISOString().slice(0, 7);
        incomeByMonth.set(month, (incomeByMonth.get(month) ?? 0) + b.amount.toNumber());
      }

      const bookingResponses: ShortLetBookingResponse[] =
        listingBookings.map(mapShortLetBooking);
      const blockResponses: ShortLetAvailabilityBlockResponse[] = listingBlocks.map(
        mapShortLetAvailabilityBlock,
      );

      return {
        listingId: listing.id,
        propertyId: listing.propertyId,
        title: listing.property.title,
        currency: listing.currency,
        nightlyPrice: listing.price.toNumber(),
        income: metrics.income,
        bookedNights: metrics.bookedNights,
        availableNights: metrics.availableNights,
        occupancyRate: metrics.occupancyRate,
        bookings: bookingResponses,
        blocks: blockResponses,
      };
    });

    const overallOccupancy =
      totalAvailableNights > 0 ? Math.min(1, totalBookedNights / totalAvailableNights) : 0;

    const incomeByMonthArr = [...incomeByMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, amount]) => ({ month, amount }));

    return {
      subscription: {
        plan: sub.plan,
        status: sub.status,
        expiresAt: sub.expiresAt.toISOString(),
      },
      window: {
        start: winStart.toISOString().slice(0, 10),
        end: winEnd.toISOString().slice(0, 10),
        nights: WINDOW_NIGHTS,
      },
      totals: {
        income: totalIncome,
        currency: shortLet[0]?.currency ?? DEFAULT_CURRENCY,
        occupancyRate: overallOccupancy,
        listings: shortLet.length,
        bookings: totalBookings,
      },
      incomeByMonth: incomeByMonthArr,
      listings,
      selectableListings: allListings.map((l) => ({
        listingId: l.id,
        title: l.property.title,
        isShortLet: l.isShortLet,
      })),
    };
  }

  async createBooking(
    user: AuthenticatedUser,
    dto: CreateShortLetBookingDto,
  ): Promise<ShortLetBookingResponse> {
    await this.assertOwns(dto.listingId, user.id);
    const checkIn = new Date(dto.checkIn);
    const checkOut = new Date(dto.checkOut);
    if (nightsBetween(checkIn, checkOut) < 1) {
      throw new BadRequestException('Check-out must be after check-in');
    }
    // Recording a stay marks the listing short-let so it appears on the dashboard.
    await this.repo.markShortLet(dto.listingId);
    const booking = await this.repo.createBooking({
      listingId: dto.listingId,
      checkIn,
      checkOut,
      amount: dto.amount,
      currency: dto.currency ?? DEFAULT_CURRENCY,
      guestName: dto.guestName?.trim() || null,
      status: ShortLetBookingStatus.BOOKED,
    });
    return mapShortLetBooking(booking);
  }

  async createBlock(
    user: AuthenticatedUser,
    dto: CreateAvailabilityBlockDto,
  ): Promise<ShortLetAvailabilityBlockResponse> {
    await this.assertOwns(dto.listingId, user.id);
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('End date cannot be before the start date');
    }
    await this.repo.markShortLet(dto.listingId);
    const block = await this.repo.createBlock({
      listingId: dto.listingId,
      startDate,
      endDate,
      note: dto.note?.trim() || null,
    });
    return mapShortLetAvailabilityBlock(block);
  }

  private async assertOwns(listingId: string, ownerId: string): Promise<void> {
    const listing = await this.repo.findAgentListing(listingId, ownerId);
    if (!listing) throw new NotFoundException('Listing not found or not yours');
  }
}
