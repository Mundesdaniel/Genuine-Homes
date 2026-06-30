import { Injectable } from '@nestjs/common';
import type { Review, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ReviewWithAuthor = Review & {
  author: Pick<User, 'id' | 'fullName'>;
};

@Injectable()
export class ReviewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  targetExists(id: string): Promise<{ id: string } | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
  }

  // One review per (author, target): a repeat submission updates the existing
  // one rather than failing on the unique constraint.
  upsert(
    authorId: string,
    targetId: string,
    rating: number,
    comment: string | null,
  ): Promise<ReviewWithAuthor> {
    return this.prisma.review.upsert({
      where: { authorId_targetId: { authorId, targetId } },
      create: { authorId, targetId, rating, comment },
      update: { rating, comment },
      include: { author: { select: { id: true, fullName: true } } },
    });
  }

  async listForTarget(
    targetId: string,
    skip: number,
    take: number,
  ): Promise<[ReviewWithAuthor[], number]> {
    return this.prisma.$transaction([
      this.prisma.review.findMany({
        where: { targetId },
        include: { author: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.review.count({ where: { targetId } }),
    ]);
  }

  async summary(targetId: string): Promise<{ average: number; count: number }> {
    const result = await this.prisma.review.aggregate({
      where: { targetId },
      _avg: { rating: true },
      _count: true,
    });
    return {
      average: result._avg.rating ?? 0,
      count: result._count,
    };
  }
}
