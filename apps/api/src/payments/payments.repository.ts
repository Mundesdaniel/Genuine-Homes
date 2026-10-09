import { Injectable } from '@nestjs/common';
import type { Payment } from '@prisma/client';
import type {
  PaymentProvider,
  PaymentPurpose,
  PaymentStatus,
} from '@genuine-homes/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface CreatePaymentData {
  userId: string;
  purpose: PaymentPurpose;
  referenceId: string | null;
  amount: number;
  currency: string;
  provider: PaymentProvider;
}

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreatePaymentData): Promise<Payment> {
    return this.prisma.payment.create({ data });
  }

  findById(id: string): Promise<Payment | null> {
    return this.prisma.payment.findUnique({ where: { id } });
  }

  async listByUser(
    userId: string,
    skip: number,
    take: number,
  ): Promise<[Payment[], number]> {
    const where = { userId };
    return this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.payment.count({ where }),
    ]);
  }

  async setProviderRef(id: string, providerRef: string): Promise<void> {
    await this.prisma.payment.update({ where: { id }, data: { providerRef } });
  }

  async markFailed(id: string): Promise<void> {
    await this.prisma.payment.updateMany({
      where: { id, status: 'pending' },
      data: { status: 'failed' },
    });
  }

  /**
   * Idempotent settle: only a still-`pending` payment transitions. Returns true
   * if this call changed it, false if it was already settled (duplicate
   * webhook). The unique `provider_ref` is the second line of defence.
   */
  async settle(
    txRef: string,
    providerRef: string,
    status: PaymentStatus,
  ): Promise<boolean> {
    const result = await this.prisma.payment.updateMany({
      where: { id: txRef, status: 'pending' },
      data: { providerRef, status },
    });
    return result.count > 0;
  }

  findUser(
    id: string,
  ): Promise<{ fullName: string; email: string | null; phone: string } | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { fullName: true, email: true, phone: true },
    });
  }

  /**
   * Income received on an owner's listings, grouped by month. `reference_id` is
   * polymorphic by `purpose`, so resolve it to a listing per purpose:
   *   purchase    → the listing id itself
   *   rent        → rental_agreements.listing_id
   *   installment → installment_plans.listing_id
   *   deposit     → installment_plans.listing_id
   * Platform fees (verification_fee, featured_listing) are excluded — that's
   * money the owner paid out, not earned.
   */
  async earningsByOwner(ownerId: string): Promise<{ month: string; amount: number }[]> {
    const rows = await this.prisma.$queryRaw<{ month: string; amount: number }[]>`
      SELECT to_char(date_trunc('month', p.created_at), 'YYYY-MM') AS month,
             sum(p.amount)::float8 AS amount
      FROM payments p
      JOIN listings l ON l.id = CASE p.purpose
        WHEN 'purchase' THEN p.reference_id
        WHEN 'rent' THEN (SELECT ra.listing_id FROM rental_agreements ra WHERE ra.id = p.reference_id)
        WHEN 'installment' THEN (SELECT ip.listing_id FROM installment_plans ip WHERE ip.id = p.reference_id)
        WHEN 'deposit' THEN (SELECT ip.listing_id FROM installment_plans ip WHERE ip.id = p.reference_id)
        ELSE NULL
      END
      JOIN properties pr ON pr.id = l.property_id
      WHERE p.status = 'successful'
        AND pr.owner_id = ${ownerId}::uuid
        AND p.purpose IN ('purchase', 'rent', 'installment', 'deposit')
      GROUP BY 1
      ORDER BY 1
    `;
    return rows.map((r) => ({ month: r.month, amount: Number(r.amount) }));
  }
}
