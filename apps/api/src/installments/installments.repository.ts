import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  InstallmentPayment,
  InstallmentPlan,
  Listing,
} from '@prisma/client';
import type { InstallmentPlanStatus } from '@genuine-homes/shared';
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

@Injectable()
export class InstallmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveInstallmentListing(id: string): Promise<Listing | null> {
    return this.prisma.listing.findFirst({
      where: {
        id,
        deletedAt: null,
        isActive: true,
        listingType: 'installment',
      },
    });
  }

  // Plan + its full schedule, created atomically.
  async createPlanWithSchedule(
    plan: PlanCreateData,
    schedule: ScheduleItem[],
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
          status: 'pending_deposit',
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
