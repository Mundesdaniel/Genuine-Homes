import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import {
  type NotificationResponse,
  NotificationType,
  type Paginated,
  PaymentPurpose,
  type UnreadCountResponse,
} from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { mapNotification } from '../common/mappers';
import {
  INSTALLMENT_DUE_SOON,
  INSTALLMENT_OVERDUE,
  type InstallmentReminderEvent,
} from '../installments/installment-events';
import {
  PAYMENT_FAILED,
  type PaymentFailedEvent,
  PAYMENT_SUCCEEDED,
  type PaymentSucceededEvent,
} from '../payments/payment-events';
import { NotificationsRepository } from './notifications.repository';
import {
  NOTIFICATION_SENDERS,
  type NotificationSender,
} from './senders/notification-sender.interface';

function formatAmount(currency: string, amount: number): string {
  return `${currency} ${amount.toLocaleString('en-US')}`;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly repo: NotificationsRepository,
    @Inject(NOTIFICATION_SENDERS)
    private readonly senders: NotificationSender[],
  ) {}

  // ── Queries (current user) ─────────────────────────────────────────────────

  async listMine(
    user: AuthenticatedUser,
    page: number,
    pageSize: number,
  ): Promise<Paginated<NotificationResponse>> {
    const [rows, total] = await this.repo.listByUser(
      user.id,
      (page - 1) * pageSize,
      pageSize,
    );
    return { items: rows.map(mapNotification), total, page, pageSize };
  }

  async unreadCount(user: AuthenticatedUser): Promise<UnreadCountResponse> {
    return { unread: await this.repo.countUnread(user.id) };
  }

  async markRead(user: AuthenticatedUser, id: string): Promise<UnreadCountResponse> {
    await this.repo.markRead(user.id, id);
    return this.unreadCount(user);
  }

  async markAllRead(user: AuthenticatedUser): Promise<UnreadCountResponse> {
    await this.repo.markAllRead(user.id);
    return { unread: 0 };
  }

  /**
   * Create an in-app notification and fan it out to every delivery channel.
   * Public so sibling modules can notify directly (e.g. a verified listing)
   * without going through an event.
   */
  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data: Record<string, unknown> = {},
  ): Promise<void> {
    const payload = { title, body, ...data } as Prisma.InputJsonValue;
    await this.repo.create(userId, type, payload);
    await this.dispatch({ userId, type, title, body });
  }

  // ── Event listeners ─────────────────────────────────────────────────────────

  @OnEvent(PAYMENT_SUCCEEDED)
  async onPaymentSucceeded(event: PaymentSucceededEvent): Promise<void> {
    await this.guard(PAYMENT_SUCCEEDED, async () => {
      const amount = formatAmount('UGX', event.amount);
      const { title, body } = this.successCopy(event.purpose, amount);
      await this.notify(
        event.userId,
        NotificationType.PAYMENT_SUCCESSFUL,
        title,
        body,
        { paymentId: event.paymentId, referenceId: event.referenceId, purpose: event.purpose },
      );
    });
  }

  @OnEvent(PAYMENT_FAILED)
  async onPaymentFailed(event: PaymentFailedEvent): Promise<void> {
    await this.guard(PAYMENT_FAILED, async () => {
      await this.notify(
        event.userId,
        NotificationType.PAYMENT_FAILED,
        'Payment failed',
        `Your payment of ${formatAmount('UGX', event.amount)} could not be completed. Please try again.`,
        { paymentId: event.paymentId, referenceId: event.referenceId, purpose: event.purpose },
      );
    });
  }

  @OnEvent(INSTALLMENT_DUE_SOON)
  async onInstallmentDueSoon(event: InstallmentReminderEvent): Promise<void> {
    await this.guard(INSTALLMENT_DUE_SOON, async () => {
      // Idempotent: the nightly sweep may re-emit until the item is paid.
      if (
        await this.repo.existsForReference(
          event.buyerId,
          NotificationType.INSTALLMENT_DUE_SOON,
          'installmentId',
          event.installmentId,
        )
      ) {
        return;
      }
      await this.notify(
        event.buyerId,
        NotificationType.INSTALLMENT_DUE_SOON,
        'Installment due soon',
        `Installment ${event.sequence} of ${formatAmount(event.currency, event.amount)} is due on ${event.dueDate}.`,
        { planId: event.planId, installmentId: event.installmentId, sequence: event.sequence, dueDate: event.dueDate },
      );
    });
  }

  @OnEvent(INSTALLMENT_OVERDUE)
  async onInstallmentOverdue(event: InstallmentReminderEvent): Promise<void> {
    await this.guard(INSTALLMENT_OVERDUE, async () => {
      if (
        await this.repo.existsForReference(
          event.buyerId,
          NotificationType.INSTALLMENT_OVERDUE,
          'installmentId',
          event.installmentId,
        )
      ) {
        return;
      }
      await this.notify(
        event.buyerId,
        NotificationType.INSTALLMENT_OVERDUE,
        'Installment overdue',
        `Installment ${event.sequence} of ${formatAmount(event.currency, event.amount)} was due on ${event.dueDate} and is now overdue.`,
        { planId: event.planId, installmentId: event.installmentId, sequence: event.sequence, dueDate: event.dueDate },
      );
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private successCopy(
    purpose: PaymentPurpose,
    amount: string,
  ): { title: string; body: string } {
    switch (purpose) {
      case PaymentPurpose.DEPOSIT:
        return {
          title: 'Deposit received',
          body: `We received your deposit of ${amount}. Your installment plan is now active.`,
        };
      case PaymentPurpose.INSTALLMENT:
        return {
          title: 'Installment payment received',
          body: `Your installment payment of ${amount} was successful.`,
        };
      case PaymentPurpose.RENT:
        return {
          title: 'Rent payment received',
          body: `Your rent payment of ${amount} was successful.`,
        };
      default:
        return {
          title: 'Payment received',
          body: `Your payment of ${amount} was successful.`,
        };
    }
  }

  // Resolve the recipient and push the notification to every channel. Each
  // sender failure is isolated so one bad channel never blocks the others.
  private async dispatch(base: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
  }): Promise<void> {
    const contact = await this.repo.findUserContact(base.userId);
    if (!contact) return;
    const outbound = { ...base, phone: contact.phone, email: contact.email };
    await Promise.all(
      this.senders.map((sender) =>
        sender
          .send(outbound)
          .catch((err) =>
            this.logger.error(`Sender ${sender.channel} failed: ${String(err)}`),
          ),
      ),
    );
  }

  // Event listeners must never throw back into the emitter — log and swallow.
  private async guard(event: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.error(`Failed handling ${event}: ${String(err)}`);
    }
  }
}
