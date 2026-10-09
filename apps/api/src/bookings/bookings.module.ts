import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsController } from './bookings.controller';
import { BookingsRepository } from './bookings.repository';
import { BookingsService } from './bookings.service';

/**
 * Viewing bookings. A buyer requests to view a property; the owner (the
 * seller/agent/landlord who posted it) accepts or declines. Imports
 * NotificationsModule to notify the owner (and, on a decision, the buyer).
 */
@Module({
  imports: [NotificationsModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsRepository],
})
export class BookingsModule {}
