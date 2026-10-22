import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Subscription } from '@prisma/client';
import {
  type Paginated,
  SubscriptionStatus,
  type SubscriptionResponse,
} from '@genuine-homes/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { mapSubscription } from '../common/mappers';
import { RecordSubscriptionPaymentDto } from './dto/record-subscription-payment.dto';
import { SubscriptionsRepository } from './subscriptions.repository';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly repo: SubscriptionsRepository,
    private readonly audit: AuditService,
  ) {}

  /**
   * Admin records a cash subscription payment and activates it. Billing is
   * cash-only: there is no gateway — recording the payment *is* the activation.
   */
  async recordPayment(
    actor: AuthenticatedUser,
    dto: RecordSubscriptionPaymentDto,
  ): Promise<SubscriptionResponse> {
    const startsAt = new Date(dto.startsAt);
    const expiresAt = new Date(dto.expiresAt);
    if (expiresAt <= startsAt) {
      throw new BadRequestException('Expiry must be after the start date');
    }

    const sub = await this.repo.create({
      userId: dto.userId,
      plan: dto.plan,
      status: SubscriptionStatus.ACTIVE,
      startsAt,
      expiresAt,
    });
    await this.audit.record({
      actorId: actor.id,
      action: 'subscription.payment_recorded',
      entityType: 'subscription',
      entityId: sub.id,
      metadata: {
        userId: dto.userId,
        plan: dto.plan,
        startsAt: dto.startsAt,
        expiresAt: dto.expiresAt,
      },
    });
    this.logger.log(`Recorded subscription ${sub.id} for user ${dto.userId}`);
    return mapSubscription(sub);
  }

  /** Admin cancels a subscription (revokes access immediately). */
  async cancel(actor: AuthenticatedUser, id: string): Promise<SubscriptionResponse> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Subscription not found');

    const updated = await this.repo.updateStatus(id, SubscriptionStatus.CANCELLED);
    await this.audit.record({
      actorId: actor.id,
      action: 'subscription.cancelled',
      entityType: 'subscription',
      entityId: id,
      metadata: { userId: existing.userId, previousStatus: existing.status },
    });
    this.logger.log(`Cancelled subscription ${id}`);
    return mapSubscription(updated);
  }

  async list(page: number, pageSize: number): Promise<Paginated<SubscriptionResponse>> {
    const [rows, total] = await this.repo.listAll((page - 1) * pageSize, pageSize);
    return { items: rows.map(mapSubscription), total, page, pageSize };
  }

  /** The caller's current (most recent) subscription, or null. */
  async getMine(user: AuthenticatedUser): Promise<SubscriptionResponse | null> {
    const sub = await this.repo.findLatestForUser(user.id);
    return sub ? mapSubscription(sub) : null;
  }

  /** Raw lookup used by SubscriptionGuard to decide access. */
  getCurrentForUser(userId: string): Promise<Subscription | null> {
    return this.repo.findLatestForUser(userId);
  }
}
