import { Injectable } from '@nestjs/common';
import { Prisma, type Subscription } from '@prisma/client';
import type { SubscriptionStatus } from '@genuine-homes/shared';
import { PrismaService } from '../prisma/prisma.service';

// The account context carried on the admin list (avoids a second lookup).
const withUser = {
  user: { select: { id: true, fullName: true, phone: true, email: true } },
} satisfies Prisma.SubscriptionInclude;

export type SubscriptionWithUser = Prisma.SubscriptionGetPayload<{ include: typeof withUser }>;

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
}
