import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Paginated } from '@genuine-homes/shared';
import { requestContext } from '../common/request-context';
import {
  type AuditLogFilters,
  AuditRepository,
  type AuditLogWithActor,
} from './audit.repository';

export interface AuditEntry {
  /** Null/omitted for system-initiated events (webhooks, scheduled sweeps). */
  actorId?: string | null;
  /** Dotted verb, e.g. "payment.settled", "plan.defaulted". */
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogResponse {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
  ip: string | null;
  requestId: string | null;
  createdAt: string;
}

/**
 * Append-only audit trail (payment events + admin actions — a spec
 * requirement). `record` is fire-safe: a failure to write an audit row is
 * logged but never breaks the business operation that triggered it.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly repo: AuditRepository) {}

  async record(entry: AuditEntry): Promise<void> {
    const ctx = requestContext.getStore();
    try {
      await this.repo.create({
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        metadata: (entry.metadata ?? {}) as Prisma.InputJsonValue,
        ip: ctx?.ip ?? null,
        requestId: ctx?.requestId ?? null,
      });
    } catch (err) {
      this.logger.error(
        `Failed to write audit entry ${entry.action} for ${entry.entityType ?? '?'}/${entry.entityId ?? '?'}: ${String(err)}`,
      );
    }
  }

  async list(
    filters: AuditLogFilters,
    page: number,
    pageSize: number,
  ): Promise<Paginated<AuditLogResponse>> {
    const [rows, total] = await this.repo.list(
      filters,
      (page - 1) * pageSize,
      pageSize,
    );
    return { items: rows.map(mapAuditLog), total, page, pageSize };
  }
}

function mapAuditLog(row: AuditLogWithActor): AuditLogResponse {
  return {
    id: row.id,
    actorId: row.actorId,
    actorName: row.actor?.fullName ?? null,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: row.metadata,
    ip: row.ip,
    requestId: row.requestId,
    createdAt: row.createdAt.toISOString(),
  };
}
