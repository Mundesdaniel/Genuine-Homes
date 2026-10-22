import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ShortLetController } from './short-let.controller';
import { ShortLetService } from './short-let.service';

/**
 * Short-let ("AirBnB") dashboard. Imports SubscriptionsModule for the
 * SubscriptionGuard + SubscriptionsService that gate access.
 */
@Module({
  imports: [SubscriptionsModule],
  controllers: [ShortLetController],
  providers: [ShortLetService],
})
export class ShortLetModule {}
