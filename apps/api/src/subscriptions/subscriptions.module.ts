import { Module } from '@nestjs/common';
import { SubscriptionGuard } from './guards/subscription.guard';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsRepository } from './subscriptions.repository';
import { SubscriptionsService } from './subscriptions.service';

/**
 * AirBnB-agent subscriptions: admin-managed, cash-billed access control. Exports
 * SubscriptionsService + SubscriptionGuard so the short-let module can gate its
 * routes on an active subscription.
 */
@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionsRepository, SubscriptionGuard],
  exports: [SubscriptionsService, SubscriptionGuard],
})
export class SubscriptionsModule {}
