import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface OverviewCounts {
  users: number;
  properties: number;
  activeListings: number;
  activePlans: number;
  pendingVerifications: number;
  revenueTotal: number;
}

// A property row with the agent who added it, for the internal properties table.
const propertyWithAgent = {
  owner: { select: { id: true, fullName: true, phone: true, role: true } },
} satisfies Prisma.PropertyInclude;
export type PropertyWithAgent = Prisma.PropertyGetPayload<{
  include: typeof propertyWithAgent;
}>;

// A rental agreement with its tenant and the agent behind the listing.
const rentalWithParties = {
  tenant: { select: { id: true, fullName: true, phone: true } },
  listing: {
    select: {
      property: {
        select: {
          id: true,
          title: true,
          owner: { select: { id: true, fullName: true, phone: true, role: true } },
        },
      },
    },
  },
} satisfies Prisma.RentalAgreementInclude;
export type RentalWithParties = Prisma.RentalAgreementGetPayload<{
  include: typeof rentalWithParties;
}>;

// An installment plan with its buyer and the agent behind the listing.
const planWithParties = {
  buyer: { select: { id: true, fullName: true, phone: true } },
  listing: {
    select: {
      property: {
        select: {
          id: true,
          title: true,
          owner: { select: { id: true, fullName: true, phone: true, role: true } },
        },
      },
    },
  },
} satisfies Prisma.InstallmentPlanInclude;
export type PlanWithParties = Prisma.InstallmentPlanGetPayload<{
  include: typeof planWithParties;
}>;

// A settled purchase payment with its buyer (the payer).
const purchaseWithBuyer = {
  user: { select: { id: true, fullName: true, phone: true } },
} satisfies Prisma.PaymentInclude;
export type PurchaseWithBuyer = Prisma.PaymentGetPayload<{
  include: typeof purchaseWithBuyer;
}>;

// A listing + its property + the owning agent, keyed from a purchase's referenceId
// (purchase payments point at a listing id, with no DB-level FK).
const listingWithAgent = {
  property: {
    select: {
      id: true,
      title: true,
      owner: { select: { id: true, fullName: true, phone: true, role: true } },
    },
  },
} satisfies Prisma.ListingInclude;
export type ListingWithAgent = Prisma.ListingGetPayload<{ include: typeof listingWithAgent }>;

/** Rental statuses that mean a tenancy actually started (the agent placed a tenant). */
export const SUCCESSFUL_RENTAL_STATUSES = ['active', 'ended', 'terminated'] as const;
/** Installment statuses that mean the deal got over the line (deposit paid onward). */
export const SUCCESSFUL_PLAN_STATUSES = ['active', 'completed'] as const;

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

  // ── Properties (with the agent who added them) ──────────────────────────────

  async listProperties(skip: number, take: number): Promise<[PropertyWithAgent[], number]> {
    const where: Prisma.PropertyWhereInput = { deletedAt: null };
    return this.prisma.$transaction([
      this.prisma.property.findMany({
        where,
        include: propertyWithAgent,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.property.count({ where }),
    ]);
  }

  /** How many properties each owner (agent) has added. */
  async propertiesByOwner(): Promise<Array<{ ownerId: string; count: number }>> {
    const rows = await this.prisma.property.groupBy({
      by: ['ownerId'],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    return rows.map((r) => ({ ownerId: r.ownerId, count: r._count._all }));
  }

  // ── Successful deals (rentals + installments + outright purchases) ───────────

  successfulRentals(): Promise<RentalWithParties[]> {
    return this.prisma.rentalAgreement.findMany({
      where: { status: { in: [...SUCCESSFUL_RENTAL_STATUSES] } },
      include: rentalWithParties,
      orderBy: { createdAt: 'desc' },
    });
  }

  successfulPlans(): Promise<PlanWithParties[]> {
    return this.prisma.installmentPlan.findMany({
      where: { status: { in: [...SUCCESSFUL_PLAN_STATUSES] } },
      include: planWithParties,
      orderBy: { createdAt: 'desc' },
    });
  }

  successfulPurchases(): Promise<PurchaseWithBuyer[]> {
    return this.prisma.payment.findMany({
      where: { purpose: 'purchase', status: 'successful' },
      include: purchaseWithBuyer,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Resolve purchase referenceIds (listing ids) → listing + property + agent. */
  async listingsByIds(ids: string[]): Promise<Map<string, ListingWithAgent>> {
    const map = new Map<string, ListingWithAgent>();
    if (ids.length === 0) return map;
    const rows = await this.prisma.listing.findMany({
      where: { id: { in: ids } },
      include: listingWithAgent,
    });
    for (const row of rows) map.set(row.id, row);
    return map;
  }

  /** Account details for a set of user ids — fills in agents that only appear in
   *  the properties rollup (no deals yet). */
  async usersByIds(
    ids: string[],
  ): Promise<Map<string, { id: string; fullName: string; phone: string; role: string }>> {
    const map = new Map<
      string,
      { id: string; fullName: string; phone: string; role: string }
    >();
    if (ids.length === 0) return map;
    const rows = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullName: true, phone: true, role: true },
    });
    for (const row of rows) map.set(row.id, row);
    return map;
  }
}
