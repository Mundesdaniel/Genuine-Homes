import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Subscription } from '@prisma/client';
import { SubscriptionStatus, UserRole } from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../../auth/types/jwt-payload';
import type { SubscriptionsService } from '../subscriptions.service';
import { SubscriptionGuard } from './subscription.guard';

const user: AuthenticatedUser = { id: 'u1', role: UserRole.AIRBNB_AGENT };

const contextWith = (u?: AuthenticatedUser): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user: u }) }),
  }) as unknown as ExecutionContext;

const DAY = 24 * 60 * 60 * 1000;

const sub = (over: Partial<Subscription> = {}): Subscription =>
  ({
    id: 's1',
    userId: 'u1',
    plan: 'airbnb_monthly',
    status: SubscriptionStatus.ACTIVE,
    startsAt: new Date(Date.now() - DAY),
    expiresAt: new Date(Date.now() + DAY),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as unknown as Subscription;

// A guard wired to a stub service that returns the given "current" subscription.
const guardWith = (current: Subscription | null): SubscriptionGuard => {
  const service = {
    getCurrentForUser: jest.fn().mockResolvedValue(current),
  } as unknown as SubscriptionsService;
  return new SubscriptionGuard(service);
};

describe('SubscriptionGuard', () => {
  it('allows an active, unexpired subscription', async () => {
    await expect(guardWith(sub()).canActivate(contextWith(user))).resolves.toBe(true);
  });

  it('blocks an expired subscription (status = expired)', async () => {
    await expect(
      guardWith(sub({ status: SubscriptionStatus.EXPIRED })).canActivate(contextWith(user)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks a cancelled subscription', async () => {
    await expect(
      guardWith(sub({ status: SubscriptionStatus.CANCELLED })).canActivate(contextWith(user)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks when there is no subscription', async () => {
    await expect(guardWith(null).canActivate(contextWith(user))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('blocks an active status whose expiry has already passed', async () => {
    await expect(
      guardWith(sub({ expiresAt: new Date(Date.now() - 1000) })).canActivate(
        contextWith(user),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks when no authenticated user is present', async () => {
    await expect(guardWith(sub()).canActivate(contextWith(undefined))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
