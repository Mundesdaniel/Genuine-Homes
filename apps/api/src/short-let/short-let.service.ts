import { Injectable, NotFoundException } from '@nestjs/common';
import type { ShortLetDashboardResponse } from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

/**
 * Short-let ("AirBnB") dashboard. A placeholder for the full feature — for now
 * it surfaces the caller's subscription state. Access is gated upstream by
 * SubscriptionGuard, so reaching here means the subscription is active.
 */
@Injectable()
export class ShortLetService {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  async dashboard(user: AuthenticatedUser): Promise<ShortLetDashboardResponse> {
    const sub = await this.subscriptions.getCurrentForUser(user.id);
    // The guard guarantees an active subscription before this runs.
    if (!sub) throw new NotFoundException('No subscription found');
    return {
      subscription: {
        plan: sub.plan,
        status: sub.status,
        expiresAt: sub.expiresAt.toISOString(),
      },
      listings: [],
    };
  }
}
