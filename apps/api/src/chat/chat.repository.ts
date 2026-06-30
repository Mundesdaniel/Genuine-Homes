import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Message } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type MessageWithNames = Message & {
  sender: { id: string; fullName: string };
  receiver: { id: string; fullName: string };
};

@Injectable()
export class ChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    senderId: string,
    receiverId: string,
    listingId: string | null,
    body: string,
  ): Promise<Message> {
    return this.prisma.message.create({
      data: { senderId, receiverId, listingId, body },
    });
  }

  userExists(id: string): Promise<{ id: string } | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
  }

  // All messages between two users, oldest first (chat order).
  async thread(
    userId: string,
    partnerId: string,
    skip: number,
    take: number,
  ): Promise<[Message[], number]> {
    const where: Prisma.MessageWhereInput = {
      OR: [
        { senderId: userId, receiverId: partnerId },
        { senderId: partnerId, receiverId: userId },
      ],
    };
    return this.prisma.$transaction([
      this.prisma.message.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
      this.prisma.message.count({ where }),
    ]);
  }

  // Mark messages the partner sent to this user as read.
  async markThreadRead(userId: string, partnerId: string): Promise<number> {
    const { count } = await this.prisma.message.updateMany({
      where: { receiverId: userId, senderId: partnerId, readAt: null },
      data: { readAt: new Date() },
    });
    return count;
  }

  // Recent messages involving the user, newest first, with both names — the
  // service reduces these to one row per conversation partner.
  recentInvolving(userId: string, take: number): Promise<MessageWithNames[]> {
    return this.prisma.message.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      include: {
        sender: { select: { id: true, fullName: true } },
        receiver: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  // Unread counts grouped by who sent them, for this recipient.
  async unreadBySender(userId: string): Promise<Map<string, number>> {
    const rows = await this.prisma.message.groupBy({
      by: ['senderId'],
      where: { receiverId: userId, readAt: null },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.senderId, r._count._all]));
  }
}
