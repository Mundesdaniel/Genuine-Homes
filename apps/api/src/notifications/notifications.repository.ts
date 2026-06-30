import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Notification } from '@prisma/client';
import type { NotificationType } from '@genuine-homes/shared';
import { PrismaService } from '../prisma/prisma.service';

/** The contact fields a sender needs to reach a user. */
export interface UserContact {
  fullName: string;
  phone: string;
  email: string | null;
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    userId: string,
    type: NotificationType,
    payload: Prisma.InputJsonValue,
  ): Promise<Notification> {
    return this.prisma.notification.create({
      data: { userId, type, payload },
    });
  }

  async listByUser(
    userId: string,
    skip: number,
    take: number,
  ): Promise<[Notification[], number]> {
    return this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
  }

  async countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  // Scoped by userId so a user can only mark their own notification read.
  async markRead(userId: string, id: string): Promise<number> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return count;
  }

  async markAllRead(userId: string): Promise<number> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return count;
  }

  /**
   * Whether a notification of `type` already references `value` at
   * `payload.<key>` for this user. Used to keep the nightly sweep idempotent so
   * a buyer isn't reminded about the same installment twice.
   */
  async existsForReference(
    userId: string,
    type: NotificationType,
    key: string,
    value: string,
  ): Promise<boolean> {
    const found = await this.prisma.notification.findFirst({
      where: { userId, type, payload: { path: [key], equals: value } },
      select: { id: true },
    });
    return found !== null;
  }

  async findUserContact(userId: string): Promise<UserContact | null> {
    return this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { fullName: true, phone: true, email: true },
    });
  }
}
