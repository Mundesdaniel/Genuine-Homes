import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Listing, Property, PropertyImage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// A favorited property's representative active listing, shaped for the same
// card the search results use.
export type FavoriteListing = Listing & {
  property: Property & { images: PropertyImage[] };
};

@Injectable()
export class FavoritesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Idempotent add: a repeat favorite is a no-op (the unique constraint would
  // otherwise throw). Returns true when a new row was created.
  async add(userId: string, propertyId: string): Promise<boolean> {
    const result = await this.prisma.favorite.createMany({
      data: { userId, propertyId },
      skipDuplicates: true,
    });
    return result.count > 0;
  }

  async remove(userId: string, propertyId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { userId, propertyId } });
  }

  // The user's favorited properties that still have an active listing, newest
  // favorite first, each represented by its most recent active listing so the
  // saved-properties page renders like search results.
  async listActiveListings(
    userId: string,
    skip: number,
    take: number,
  ): Promise<[FavoriteListing[], number]> {
    const where: Prisma.FavoriteWhereInput = {
      userId,
      property: {
        deletedAt: null,
        listings: { some: { deletedAt: null, isActive: true } },
      },
    };
    const [favorites, total] = await this.prisma.$transaction([
      this.prisma.favorite.findMany({
        where,
        include: {
          property: {
            include: {
              images: { orderBy: { position: 'asc' } },
              listings: {
                where: { deletedAt: null, isActive: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.favorite.count({ where }),
    ]);

    const items = favorites.map((f) => {
      const { listings, ...property } = f.property;
      return { ...listings[0], property };
    });
    return [items, total];
  }

  async listPropertyIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.favorite.findMany({
      where: { userId, property: { deletedAt: null } },
      select: { propertyId: true },
    });
    return rows.map((r) => r.propertyId);
  }

  propertyExists(propertyId: string): Promise<{ id: string } | null> {
    return this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
      select: { id: true },
    });
  }
}
