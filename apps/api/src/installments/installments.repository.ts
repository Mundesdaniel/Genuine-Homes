import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  InstallmentPayment,
  InstallmentPlan,
  Listing,
  Property,
} from '@prisma/client';
import type {
  InstallmentPlanStatus,
  PropertyStatus,
} from '@genuine-homes/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface PlanCreateData {
  listingId: string;
  buyerId: string;
  totalPrice: Prisma.Decimal;
  depositAmount: Prisma.Decimal;
  months: number;
  monthlyAmount: Prisma.Decimal;
  currency: string;
}

export interface ScheduleItem {
  sequence: number;
  amount: Prisma.Decimal;
  dueDate: Date;
}

export type PlanWithSchedule = InstallmentPlan & {
  payments: InstallmentPayment[];
};

/** A scheduled payment joined with the few plan fields the sweep reminders need. */
export type ScheduledPaymentWithPlan = InstallmentPayment & {
  plan: Pick<InstallmentPlan, 'id' | 'buyerId' | 'currency' | 'status'>;
};

/** An active plan that has crossed the missed-installment threshold. */
export type DefaultEligiblePlan = InstallmentPlan & {
  buyer: { id: string; fullName: string; phone: string };
  missedCount: number;
};

/** A listing a buyer can turn into a plan, plus the owning property. */
export type PlanListing = Listing & {
  property: Pick<Property, 'id' | 'ownerId' | 'status'>;
};

/** A plan awaiting landlord approval, with the buyer + property for the queue. */
export type PlanRequestRow = InstallmentPlan & {
  buyer: { id: string; fullName: string; phone: string };
  listing: { property: { title: string; ownerId: string } };
};

/** A plan with just the owning seller's id — for accept/decline authorization. */
export type PlanWithOwner = InstallmentPlan & {
  listing: { property: { ownerId: string } };
};

@Injectable()
export class InstallmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // A listing a buyer can turn into a plan: the seller's own `installment` offer
  // (pre-approved) or any `sale` listing (buyer requests a plan the landlord must
  // accept). Only while the property is still active — a reserved/sold one is
  // already taken, so its listings must not accept a new plan.
  findActiveListingForPlan(id: string): Promise<PlanListing | null> {
    return this.prisma.listing.findFirst({
      where: {
        id,
        deletedAt: null,
        isActive: true,
        listingType: { in: ['sale', 'installment'] },
        property: { status: 'active' },
      },
      include: { property: { select: { id: true, ownerId: true, status: true } } },
    });
  }

  // Plan + its full schedule, created atomically. `status` is the starting
  // state: `pending_deposit` for a pre-offered installment listing, or
  // `pending_approval` when a buyer requests a plan on a plain sale listing.
  async createPlanWithSchedule(
    plan: PlanCreateData,
    schedule: ScheduleItem[],
    status: InstallmentPlanStatus,
  ): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.installmentPlan.create({
        data: {
          listingId: plan.listingId,
          buyerId: plan.buyerId,
          totalPrice: plan.totalPrice,
          depositAmount: plan.depositAmount,
          months: plan.months,
          monthlyAmount: plan.monthlyAmount,
          currency: plan.currency,
          status,
        },
      });
      await tx.installmentPayment.createMany({
        data: schedule.map((s) => ({
          planId: created.id,
          sequence: s.sequence,
          amount: s.amount,
          dueDate: s.dueDate,
          status: 'upcoming',
        })),
      });
      return created.id;
    });
  }

  findPlanById(id: string): Promise<InstallmentPlan | null> {
    return this.prisma.installmentPlan.findUnique({ where: { id } });
  }

  findPlanDetail(id: string): Promise<PlanWithSchedule | null> {
    return this.prisma.installmentPlan.findUnique({
      where: { id },
      include: { payments: { orderBy: { sequence: 'asc' } } },
    });
  }

  async findPlansByBuyer(
    buyerId: string,
    skip: number,
    take: number,
  ): Promise<[PlanWithSchedule[], number]> {
    const where = { buyerId };
    return this.prisma.$transaction([
      this.prisma.installmentPlan.findMany({
        where,
        include: { payments: { orderBy: { sequence: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.installmentPlan.count({ where }),
    ]);
  }

  findInstallmentPayment(id: string): Promise<InstallmentPayment | null> {
    return this.prisma.installmentPayment.findUnique({ where: { id } });
  }

  // Plan + the owning seller — for accept/decline authorization.
  findPlanWithOwner(id: string): Promise<PlanWithOwner | null> {
    return this.prisma.installmentPlan.findUnique({
      where: { id },
      include: {
        listing: { select: { property: { select: { ownerId: true } } } },
      },
    });
  }

  // The current status of the property behind a plan — for the deposit
  // availability guard (a plan whose property was taken by someone else first
  // must not be payable).
  async propertyStatusForPlan(planId: string): Promise<string | null> {
    const plan = await this.prisma.installmentPlan.findUnique({
      where: { id: planId },
      select: { listing: { select: { property: { select: { status: true } } } } },
    });
    return plan?.listing.property.status ?? null;
  }

  // The landlord's queue of buyer-requested plans awaiting acceptance.
  async listPlanRequestsByOwner(
    ownerId: string,
    skip: number,
    take: number,
  ): Promise<[PlanRequestRow[], number]> {
    const where: Prisma.InstallmentPlanWhereInput = {
      status: 'pending_approval',
      listing: { property: { ownerId } },
    };
    return this.prisma.$transaction([
      this.prisma.installmentPlan.findMany({
        where,
        include: {
          buyer: { select: { id: true, fullName: true, phone: true } },
          listing: { select: { property: { select: { title: true, ownerId: true } } } },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
      this.prisma.installmentPlan.count({ where }),
    ]);
  }

  async updatePlanStatus(
    id: string,
    status: InstallmentPlanStatus,
    nextDueDate: Date | null,
  ): Promise<void> {
    await this.prisma.installmentPlan.update({
      where: { id },
      data: { status, nextDueDate },
    });
  }

  async setNextDueDate(id: string, nextDueDate: Date | null): Promise<void> {
    await this.prisma.installmentPlan.update({
      where: { id },
      data: { nextDueDate },
    });
  }

  async markInstallmentPaid(id: string, paymentRef: string): Promise<void> {
    await this.prisma.installmentPayment.update({
      where: { id },
      data: { status: 'paid', paidAt: new Date(), paymentRef },
    });
  }

  // Move the property behind a listing between lifecycle states, but only from
  // an expected source status. The `status: { in: from }` guard makes the write
  // a no-op if the property has since moved on (e.g. a manual override), so
  // automatic and by-hand status changes can't clobber each other.
  async transitionPropertyStatus(
    listingId: string,
    from: PropertyStatus[],
    to: PropertyStatus,
  ): Promise<void> {
    await this.prisma.property.updateMany({
      where: { status: { in: from }, listings: { some: { id: listingId } } },
      data: { status: to },
    });
  }

  // ── Nightly sweep ─────────────────────────────────────────────────────────

  // Upcoming payments of active plans falling due in [from, to) — for "due soon"
  // reminders. `from` is today's start so already-overdue items are excluded.
  findDueSoon(from: Date, to: Date): Promise<ScheduledPaymentWithPlan[]> {
    return this.prisma.installmentPayment.findMany({
      where: {
        status: 'upcoming',
        dueDate: { gte: from, lt: to },
        plan: { status: 'active' },
      },
      include: {
        plan: { select: { id: true, buyerId: true, currency: true, status: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  // Upcoming payments of active plans whose due date has passed — these get
  // marked `late` and trigger an overdue reminder.
  findOverdue(before: Date): Promise<ScheduledPaymentWithPlan[]> {
    return this.prisma.installmentPayment.findMany({
      where: {
        status: 'upcoming',
        dueDate: { lt: before },
        plan: { status: 'active' },
      },
      include: {
        plan: { select: { id: true, buyerId: true, currency: true, status: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async markPaymentsLate(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const { count } = await this.prisma.installmentPayment.updateMany({
      where: { id: { in: ids }, status: 'upcoming' },
      data: { status: 'late' },
    });
    return count;
  }

  // `late` payments of active plans whose due date is past the grace cutoff —
  // these escalate to `missed` (the input to the default-eligibility policy).
  findLateBeyond(cutoff: Date): Promise<ScheduledPaymentWithPlan[]> {
    return this.prisma.installmentPayment.findMany({
      where: {
        status: 'late',
        dueDate: { lt: cutoff },
        plan: { status: 'active' },
      },
      include: {
        plan: { select: { id: true, buyerId: true, currency: true, status: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async markPaymentsMissed(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const { count } = await this.prisma.installmentPayment.updateMany({
      where: { id: { in: ids }, status: 'late' },
      data: { status: 'missed' },
    });
    return count;
  }

  // Active plans with >= `threshold` missed installments, worst offenders
  // first. Grouped in SQL, then hydrated with buyer contact info for the
  // admin review queue.
  async findDefaultEligible(
    threshold: number,
    skip: number,
    take: number,
  ): Promise<[DefaultEligiblePlan[], number]> {
    const groups = await this.prisma.installmentPayment.groupBy({
      by: ['planId'],
      where: { status: 'missed', plan: { status: 'active' } },
      _count: { _all: true },
      having: { planId: { _count: { gte: threshold } } },
    });
    const sorted = groups.sort((a, b) => b._count._all - a._count._all);
    const pageIds = sorted.slice(skip, skip + take).map((g) => g.planId);
    if (pageIds.length === 0) return [[], groups.length];

    const plans = await this.prisma.installmentPlan.findMany({
      where: { id: { in: pageIds } },
      include: { buyer: { select: { id: true, fullName: true, phone: true } } },
    });
    const byId = new Map(plans.map((p) => [p.id, p]));
    const rows = pageIds
      .map((id) => {
        const p = byId.get(id);
        if (!p) return null;
        const missedCount =
          sorted.find((g) => g.planId === id)?._count._all ?? 0;
        return { ...p, missedCount };
      })
      .filter((p): p is DefaultEligiblePlan => p !== null);
    return [rows, groups.length];
  }

  countMissed(planId: string): Promise<number> {
    return this.prisma.installmentPayment.count({
      where: { planId, status: 'missed' },
    });
  }

  // Earliest still-unpaid due date + whether the whole schedule is paid.
  async scheduleProgress(
    planId: string,
  ): Promise<{ nextDue: Date | null; allPaid: boolean }> {
    const items = await this.prisma.installmentPayment.findMany({
      where: { planId },
      orderBy: { sequence: 'asc' },
      select: { dueDate: true, status: true },
    });
    const unpaid = items.filter((i) => i.status !== 'paid');
    return {
      nextDue: unpaid[0]?.dueDate ?? null,
      allPaid: items.length > 0 && unpaid.length === 0,
    };
  }
}
