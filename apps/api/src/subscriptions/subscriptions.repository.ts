import { Injectable } from '@nestjs/common';
import { Prisma, type Subscription, type SubscriptionRequest } from '@prisma/client';
import type {
  SubscriptionRequestStatus,
  SubscriptionStatus,
  UserRole,
} from '@genuine-homes/shared';
import { PrismaService } from '../prisma/prisma.service';

// The account context carried on the admin list (avoids a second lookup).
const withUser = {
  user: { select: { id: true, fullName: true, phone: true, email: true } },
} satisfies Prisma.SubscriptionInclude;

export type SubscriptionWithUser = Prisma.SubscriptionGetPayload<{ include: typeof withUser }>;

const requestWithUser = {
  user: { select: { id: true, fullName: true, phone: true, email: true } },
} satisfies Prisma.SubscriptionRequestInclude;

export type SubscriptionRequestWithUser = Prisma.SubscriptionRequestGetPayload<{
  include: typeof requestWithUser;
}>;

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    userId: string;
    plan: string;
    status: SubscriptionStatus;
    startsAt: Date;
    expiresAt: Date;
  }): Promise<Subscription> {
    return this.prisma.subscription.create({ data });
  }

  findById(id: string): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({ where: { id } });
  }

  updateStatus(id: string, status: SubscriptionStatus): Promise<Subscription> {
    return this.prisma.subscription.update({ where: { id }, data: { status } });
  }

  /** The most recently created subscription for a user (what the guard checks). */
  findLatestForUser(userId: string): Promise<Subscription | null> {
    return this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  listAll(skip: number, take: number): Promise<[SubscriptionWithUser[], number]> {
    return this.prisma.$transaction([
      this.prisma.subscription.findMany({
        include: withUser,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.subscription.count(),
    ]);
  }

  // ── Subscription requests ─────────────────────────────────────────────────

  createRequest(data: {
    userId: string;
    plan: string;
    message: string | null;
  }): Promise<SubscriptionRequest> {
    return this.prisma.subscriptionRequest.create({ data });
  }

  findPendingRequestForUser(userId: string): Promise<SubscriptionRequest | null> {
    return this.prisma.subscriptionRequest.findFirst({
      where: { userId, status: 'pending' },
    });
  }

  latestRequestForUser(userId: string): Promise<SubscriptionRequestWithUser | null> {
    return this.prisma.subscriptionRequest.findFirst({
      where: { userId },
      include: requestWithUser,
      orderBy: { createdAt: 'desc' },
    });
  }

  findRequestById(id: string): Promise<SubscriptionRequest | null> {
    return this.prisma.subscriptionRequest.findUnique({ where: { id } });
  }

  updateRequestStatus(
    id: string,
    status: SubscriptionRequestStatus,
  ): Promise<SubscriptionRequestWithUser> {
    return this.prisma.subscriptionRequest.update({
      where: { id },
      data: { status },
      include: requestWithUser,
    });
  }

  listRequests(
    status: SubscriptionRequestStatus | undefined,
    skip: number,
    take: number,
  ): Promise<[SubscriptionRequestWithUser[], number]> {
    const where = status ? { status } : {};
    return this.prisma.$transaction([
      this.prisma.subscriptionRequest.findMany({
        where,
        include: requestWithUser,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.subscriptionRequest.count({ where }),
    ]);
  }

  async setUserRole(userId: string, role: UserRole): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { role } });
  }
}
