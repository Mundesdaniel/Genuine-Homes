import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { SubscriptionStatus } from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../../auth/types/jwt-payload';
import { SubscriptionsService } from '../subscriptions.service';

/**
 * Gates the short-let dashboard: access is allowed only when the caller has a
 * subscription that is `active` AND whose `expiresAt` is still in the future.
 * An expired, cancelled, or missing subscription is denied.
 *
 * Runs after the global JwtAuthGuard/RolesGuard, so `request.user` is set and
 * the role has already been checked (@Roles(airbnb_agent)).
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Authentication required');

    const sub = await this.subscriptions.getCurrentForUser(user.id);
    const active =
      sub !== null && sub.status === SubscriptionStatus.ACTIVE && sub.expiresAt > new Date();

    if (!active) {
      throw new ForbiddenException(
        'An active subscription is required to access the short-let dashboard',
      );
    }
    return true;
  }
}
