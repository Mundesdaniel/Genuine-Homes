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
}
