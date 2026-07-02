import { Injectable } from '@nestjs/common';
import type { AuditLog, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogCreateData {
  actorId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Prisma.InputJsonValue;
  ip: string | null;
  requestId: string | null;
}

export interface AuditLogFilters {
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
}

export type AuditLogWithActor = AuditLog & {
  actor: { id: string; fullName: string; role: string } | null;
};

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: AuditLogCreateData): Promise<void> {
    await this.prisma.auditLog.create({ data });
  }

  // Newest first — the audit trail is append-only, so this is a stable order.
  async list(
    filters: AuditLogFilters,
    skip: number,
    take: number,
  ): Promise<[AuditLogWithActor[], number]> {
    const where: Prisma.AuditLogWhereInput = {
      action: filters.action,
      entityType: filters.entityType,
      entityId: filters.entityId,
      actorId: filters.actorId,
    };
    return this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, fullName: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
  }
}
