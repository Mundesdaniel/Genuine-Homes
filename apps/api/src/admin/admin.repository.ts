import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface OverviewCounts {
  users: number;
  properties: number;
  activeListings: number;
  activePlans: number;
  pendingVerifications: number;
  revenueTotal: number;
}

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  // One round trip for all the dashboard numbers.
  async overview(): Promise<OverviewCounts> {
    const [users, properties, activeListings, activePlans, pendingVerifications, revenue] =
      await this.prisma.$transaction([
        this.prisma.user.count({ where: { deletedAt: null } }),
        this.prisma.property.count({ where: { deletedAt: null } }),
        this.prisma.listing.count({ where: { deletedAt: null, isActive: true } }),
        this.prisma.installmentPlan.count({ where: { status: 'active' } }),
        this.prisma.verification.count({ where: { status: 'pending' } }),
        this.prisma.payment.aggregate({
          where: { status: 'successful' },
          _sum: { amount: true },
        }),
      ]);

    return {
      users,
      properties,
      activeListings,
      activePlans,
      pendingVerifications,
      revenueTotal: revenue._sum.amount ? revenue._sum.amount.toNumber() : 0,
    };
  }
}
