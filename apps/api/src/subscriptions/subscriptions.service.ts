import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Subscription } from '@prisma/client';
import {
  type Paginated,
  SubscriptionRequestStatus,
  type SubscriptionRequestResponse,
  SubscriptionStatus,
  type SubscriptionResponse,
  UserRole,
} from '@genuine-homes/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { mapSubscription, mapSubscriptionRequest } from '../common/mappers';
import { ApproveSubscriptionRequestDto } from './dto/approve-subscription-request.dto';
import { CreateSubscriptionRequestDto } from './dto/create-subscription-request.dto';
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

  // ── Subscription requests (user self-service → admin queue) ─────────────────

  /** A user asks to subscribe as an AirBnB agent. One open request at a time. */
  async requestSubscription(
    user: AuthenticatedUser,
    dto: CreateSubscriptionRequestDto,
  ): Promise<SubscriptionRequestResponse> {
    const existing = await this.repo.findPendingRequestForUser(user.id);
    if (existing) {
      throw new ConflictException('You already have a pending subscription request');
    }
    const req = await this.repo.createRequest({
      userId: user.id,
      plan: dto.plan.trim(),
      message: dto.message?.trim() || null,
    });
    await this.audit.record({
      actorId: user.id,
      action: 'subscription.requested',
      entityType: 'subscription_request',
      entityId: req.id,
      metadata: { plan: dto.plan },
    });
    this.logger.log(`Subscription requested by ${user.id}`);
    return mapSubscriptionRequest(req);
  }

  /** The caller's most recent request (for status display), or null. */
  async myRequest(user: AuthenticatedUser): Promise<SubscriptionRequestResponse | null> {
    const req = await this.repo.latestRequestForUser(user.id);
    return req ? mapSubscriptionRequest(req) : null;
  }

  /** Admin: list requests (pending by default). */
  async listRequests(
    page: number,
    pageSize: number,
    status: SubscriptionRequestStatus = SubscriptionRequestStatus.PENDING,
  ): Promise<Paginated<SubscriptionRequestResponse>> {
    const [rows, total] = await this.repo.listRequests(
      status,
      (page - 1) * pageSize,
      pageSize,
    );
    return { items: rows.map(mapSubscriptionRequest), total, page, pageSize };
  }

  /**
   * Admin approves a request: records the (cash) subscription for the given
   * dates, grants the applicant the airbnb_agent role, and marks the request
   * approved — all in one step.
   */
  async approveRequest(
    actor: AuthenticatedUser,
    id: string,
    dto: ApproveSubscriptionRequestDto,
  ): Promise<SubscriptionResponse> {
    const req = await this.repo.findRequestById(id);
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== SubscriptionRequestStatus.PENDING) {
      throw new BadRequestException('This request has already been handled');
    }
    const startsAt = new Date(dto.startsAt);
    const expiresAt = new Date(dto.expiresAt);
    if (expiresAt <= startsAt) {
      throw new BadRequestException('Expiry must be after the start date');
    }

    const sub = await this.repo.create({
      userId: req.userId,
      plan: req.plan,
      status: SubscriptionStatus.ACTIVE,
      startsAt,
      expiresAt,
    });
    // Grant the role so they can actually reach the short-let dashboard.
    await this.repo.setUserRole(req.userId, UserRole.AIRBNB_AGENT);
    await this.repo.updateRequestStatus(id, SubscriptionRequestStatus.APPROVED);
    await this.audit.record({
      actorId: actor.id,
      action: 'subscription.request_approved',
      entityType: 'subscription_request',
      entityId: id,
      metadata: { userId: req.userId, plan: req.plan, subscriptionId: sub.id },
    });
    this.logger.log(`Approved subscription request ${id} for user ${req.userId}`);
    return mapSubscription(sub);
  }

  /** Admin declines a pending request. */
  async declineRequest(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<SubscriptionRequestResponse> {
    const req = await this.repo.findRequestById(id);
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== SubscriptionRequestStatus.PENDING) {
      throw new BadRequestException('This request has already been handled');
    }
    const updated = await this.repo.updateRequestStatus(
      id,
      SubscriptionRequestStatus.DECLINED,
    );
    await this.audit.record({
      actorId: actor.id,
      action: 'subscription.request_declined',
      entityType: 'subscription_request',
      entityId: id,
      metadata: { userId: req.userId },
    });
    return mapSubscriptionRequest(updated);
  }
}
