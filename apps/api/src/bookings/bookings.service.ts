import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  type BookingResponse,
  BookingStatus,
  NotificationType,
  type Paginated,
  PropertyStatus,
  UserRole,
} from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { mapBooking } from '../common/mappers';
import { NotificationsService } from '../notifications/notifications.service';
import { BookingsRepository, type BookingWithRelations } from './bookings.repository';
import { CreateBookingDto } from './dto/create-booking.dto';

function formatWhen(date: Date): string {
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly repo: BookingsRepository,
    private readonly notifications: NotificationsService,
  ) {}

  /** Buyer requests a viewing → the owner (poster) is notified. */
  async create(user: AuthenticatedUser, dto: CreateBookingDto): Promise<BookingResponse> {
    const listing = await this.repo.findActiveListingForBooking(dto.listingId);
    if (!listing) {
      throw new NotFoundException('This property is not available to book');
    }
    if (listing.property.status !== PropertyStatus.ACTIVE) {
      throw new BadRequestException('This property is no longer available');
    }
    if (listing.property.ownerId === user.id) {
      throw new BadRequestException('You cannot book a viewing of your own property');
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Invalid viewing date');
    }
    if (scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException('Pick a viewing time in the future');
    }

    const booking = await this.repo.create({
      listingId: listing.id,
      propertyId: listing.property.id,
      buyerId: user.id,
      ownerId: listing.property.ownerId,
      scheduledAt,
      message: dto.message?.trim() || null,
    });

    await this.notifyViewing(
      booking.ownerId,
      'New viewing request',
      `${booking.buyer.fullName} wants to view "${booking.property.title}" on ${formatWhen(scheduledAt)}.`,
      booking,
    );
    this.logger.log(`Booking ${booking.id} created by ${user.id} for owner ${booking.ownerId}`);
    return mapBooking(booking);
  }

  /** Viewings the current user has requested. */
  async listMine(
    user: AuthenticatedUser,
    page: number,
    pageSize: number,
  ): Promise<Paginated<BookingResponse>> {
    const [rows, total] = await this.repo.listByBuyer(
      user.id,
      (page - 1) * pageSize,
      pageSize,
    );
    return { items: rows.map(mapBooking), total, page, pageSize };
  }

  /** Viewing requests on properties the current user posted (owner queue). */
  async listIncoming(
    user: AuthenticatedUser,
    page: number,
    pageSize: number,
  ): Promise<Paginated<BookingResponse>> {
    const [rows, total] = await this.repo.listByOwner(
      user.id,
      (page - 1) * pageSize,
      pageSize,
    );
    return { items: rows.map(mapBooking), total, page, pageSize };
  }

  /** Owner accepts a pending viewing request. */
  async accept(user: AuthenticatedUser, id: string): Promise<BookingResponse> {
    const booking = await this.loadForOwnerDecision(user, id);
    const updated = await this.repo.updateStatus(id, BookingStatus.ACCEPTED);
    await this.notifyViewing(
      booking.buyerId,
      'Viewing confirmed',
      `Your viewing of "${updated.property.title}" on ${formatWhen(updated.scheduledAt)} was accepted.`,
      updated,
    );
    this.logger.log(`Booking ${id} accepted by ${user.id}`);
    return mapBooking(updated);
  }

  /** Owner declines a pending viewing request. */
  async decline(
    user: AuthenticatedUser,
    id: string,
    reason: string | null,
  ): Promise<BookingResponse> {
    const booking = await this.loadForOwnerDecision(user, id);
    const updated = await this.repo.updateStatus(id, BookingStatus.DECLINED);
    const suffix = reason ? ` Reason: ${reason}` : '';
    await this.notifyViewing(
      booking.buyerId,
      'Viewing declined',
      `Your viewing of "${updated.property.title}" on ${formatWhen(updated.scheduledAt)} was declined.${suffix}`,
      updated,
    );
    this.logger.log(`Booking ${id} declined by ${user.id}`);
    return mapBooking(updated);
  }

  /** Buyer cancels a viewing that is still pending or accepted. */
  async cancel(user: AuthenticatedUser, id: string): Promise<BookingResponse> {
    const booking = await this.repo.findOwnership(id);
    if (!booking) throw new NotFoundException('Booking not found');
    if (user.role !== UserRole.ADMIN && booking.buyerId !== user.id) {
      throw new ForbiddenException('This booking is not yours');
    }
    if (
      booking.status !== BookingStatus.PENDING &&
      booking.status !== BookingStatus.ACCEPTED
    ) {
      throw new BadRequestException('Only a pending or accepted viewing can be cancelled');
    }
    const updated = await this.repo.updateStatus(id, BookingStatus.CANCELLED);
    await this.notifyViewing(
      updated.ownerId,
      'Viewing cancelled',
      `${updated.buyer.fullName} cancelled the viewing of "${updated.property.title}" on ${formatWhen(updated.scheduledAt)}.`,
      updated,
    );
    this.logger.log(`Booking ${id} cancelled by ${user.id}`);
    return mapBooking(updated);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Load a booking for an owner accept/decline: must exist, be owned by the
  // caller (or admin), and still be pending.
  private async loadForOwnerDecision(
    user: AuthenticatedUser,
    id: string,
  ): Promise<BookingWithRelations> {
    const booking = await this.repo.findByIdWithRelations(id);
    if (!booking) throw new NotFoundException('Booking not found');
    if (user.role !== UserRole.ADMIN && booking.ownerId !== user.id) {
      throw new ForbiddenException('This booking is for another owner');
    }
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Only a pending viewing can be decided on');
    }
    return booking;
  }

  private async notifyViewing(
    userId: string,
    title: string,
    body: string,
    booking: BookingWithRelations,
  ): Promise<void> {
    await this.notifications.notify(userId, NotificationType.VIEWING_SCHEDULED, title, body, {
      bookingId: booking.id,
      listingId: booking.listingId,
      propertyId: booking.propertyId,
    });
  }
}
