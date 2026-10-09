import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { IdentityVerification } from '@prisma/client';
import type { VerificationStatus } from '@genuine-homes/shared';
import { PrismaService } from '../prisma/prisma.service';

export type IdentityVerificationWithUser = IdentityVerification & {
  user: { fullName: string; role: string };
};

export interface IdentitySubmissionData {
  legalName: string;
  ninMasked: string;
  ninHash: string;
  organizationName: string | null;
  registrationNumber: string | null;
  tin: string | null;
  documents: Prisma.InputJsonValue;
}

@Injectable()
export class IdentityRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserState(
    userId: string,
  ): Promise<{ id: string; role: string; identityVerifiedAt: Date | null } | null> {
    return this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, role: true, identityVerifiedAt: true },
    });
  }

  /** The user's most recent submission (any status) — drives "my status". */
  findLatestByUser(userId: string): Promise<IdentityVerification | null> {
    return this.prisma.identityVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** True while a submission is awaiting review — blocks resubmission. */
  async hasPending(userId: string): Promise<boolean> {
    const count = await this.prisma.identityVerification.count({
      where: { userId, status: 'pending' },
    });
    return count > 0;
  }

  /** Another (non-deleted) account already verified with this NIN? */
  async ninVerifiedElsewhere(ninHash: string, excludeUserId: string): Promise<boolean> {
    const count = await this.prisma.identityVerification.count({
      where: {
        ninHash,
        status: 'verified',
        userId: { not: excludeUserId },
        user: { deletedAt: null },
      },
    });
    return count > 0;
  }

  createSubmission(
    userId: string,
    data: IdentitySubmissionData,
  ): Promise<IdentityVerification> {
    return this.prisma.identityVerification.create({
      data: { userId, ...data, status: 'pending' },
    });
  }

  findById(id: string): Promise<IdentityVerificationWithUser | null> {
    return this.prisma.identityVerification.findUnique({
      where: { id },
      include: { user: { select: { fullName: true, role: true } } },
    });
  }

  async listByStatus(
    status: VerificationStatus,
    skip: number,
    take: number,
  ): Promise<[IdentityVerificationWithUser[], number]> {
    const where: Prisma.IdentityVerificationWhereInput = { status };
    return this.prisma.$transaction([
      this.prisma.identityVerification.findMany({
        where,
        include: { user: { select: { fullName: true, role: true } } },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
      this.prisma.identityVerification.count({ where }),
    ]);
  }

  // Apply the admin decision and stamp the user's verified flag atomically —
  // the flag is what the publication gate reads.
  async review(
    id: string,
    reviewerId: string,
    status: VerificationStatus,
    notes: string | null,
  ): Promise<IdentityVerificationWithUser> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.identityVerification.update({
        where: { id },
        data: { status, reviewerId, notes },
        include: { user: { select: { fullName: true, role: true } } },
      });
      if (status === 'verified') {
        await tx.user.update({
          where: { id: row.userId },
          data: { identityVerifiedAt: new Date() },
        });
      }
      return row;
    });
  }
}
