import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import type { UserRole } from '@genuine-homes/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface ProfileUpdate {
  fullName?: string;
  email?: string | null;
}

export interface AdminUserUpdate {
  role?: UserRole;
  isVerified?: boolean;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } });
  }

  update(id: string, data: ProfileUpdate | AdminUserUpdate): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  async list(
    skip: number,
    take: number,
    role?: UserRole,
  ): Promise<[User[], number]> {
    const where: Prisma.UserWhereInput = { deletedAt: null, ...(role ? { role } : {}) };
    return this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);
  }
}
