import { Injectable } from '@nestjs/common';
import type { RefreshToken, User } from '@prisma/client';
import type { UserRole } from '@genuine-homes/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Data-access layer for auth. All Prisma calls live here so the service stays
 * pure business logic (per the doc's Controller → Service → Repository layering).
 */
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Users ──────────────────────────────────────────────────────────────

  // Lookup for login — matches on either email or phone, skips soft-deleted.
  findActiveByEmailOrPhone(identifier: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ email: identifier }, { phone: identifier }],
      },
    });
  }

  findActiveById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } });
  }

  async phoneExists(phone: string): Promise<boolean> {
    return (await this.prisma.user.count({ where: { phone } })) > 0;
  }

  async emailExists(email: string): Promise<boolean> {
    return (await this.prisma.user.count({ where: { email } })) > 0;
  }

  createUser(data: {
    fullName: string;
    phone: string;
    email: string | null;
    passwordHash: string;
    role: UserRole;
  }): Promise<User> {
    return this.prisma.user.create({ data });
  }

  // ── Refresh tokens ─────────────────────────────────────────────────────

  createRefreshToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  findRefreshByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  // Mark a single session as used/rotated.
  async revokeRefreshToken(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  // Nuke every live session for a user (used on suspected token reuse).
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
