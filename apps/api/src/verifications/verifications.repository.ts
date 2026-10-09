import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Verification } from '@prisma/client';
import type { VerificationStatus } from '@genuine-homes/shared';
import { PrismaService } from '../prisma/prisma.service';

export type VerificationWithProperty = Verification & {
  property: { title: string };
};
export type VerificationWithOwner = Verification & {
  property: { title: string; ownerId: string };
};
// After a review we also pull the property's first live listing (if any) so the
// owner's "Property verified" notification can deep-link to the house.
export type VerificationReviewed = Verification & {
  property: { title: string; ownerId: string; listings: { id: string }[] };
};

@Injectable()
export class VerificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProperty(
    propertyId: string,
  ): Promise<{ id: string; ownerId: string; title: string } | null> {
    return this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
      select: { id: true, ownerId: true, title: true },
    });
  }

  // Create the submission and flip the property into `pending` atomically.
  async createSubmission(
    propertyId: string,
    documents: Prisma.InputJsonValue,
  ): Promise<VerificationWithProperty> {
    return this.prisma.$transaction(async (tx) => {
      const verification = await tx.verification.create({
        data: { propertyId, documents, status: 'pending' },
        include: { property: { select: { title: true } } },
      });
      await tx.property.update({
        where: { id: propertyId },
        data: { verificationStatus: 'pending' },
      });
      return verification;
    });
  }

  findById(id: string): Promise<VerificationWithOwner | null> {
    return this.prisma.verification.findUnique({
      where: { id },
      include: { property: { select: { title: true, ownerId: true } } },
    });
  }

  async listByStatus(
    status: VerificationStatus,
    skip: number,
    take: number,
  ): Promise<[VerificationWithProperty[], number]> {
    const where: Prisma.VerificationWhereInput = { status };
    return this.prisma.$transaction([
      this.prisma.verification.findMany({
        where,
        include: { property: { select: { title: true } } },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
      this.prisma.verification.count({ where }),
    ]);
  }

  // Apply the admin decision to both the verification row and the property's
  // badge status, atomically.
  async review(
    id: string,
    reviewerId: string,
    status: VerificationStatus,
    notes: string | null,
  ): Promise<VerificationReviewed> {
    return this.prisma.$transaction(async (tx) => {
      const verification = await tx.verification.update({
        where: { id },
        data: { status, reviewerId, notes },
        include: {
          property: {
            select: {
              title: true,
              ownerId: true,
              listings: {
                where: { isActive: true, deletedAt: null },
                select: { id: true },
                orderBy: { createdAt: 'asc' },
                take: 1,
              },
            },
          },
        },
      });
      await tx.property.update({
        where: { id: verification.propertyId },
        data: { verificationStatus: status },
      });
      return verification;
    });
  }
}
