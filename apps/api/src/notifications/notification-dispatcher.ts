import { Inject, Injectable, Logger } from '@nestjs/common';
import type { NotificationType } from '@genuine-homes/shared';
import { NotificationsRepository } from './notifications.repository';
import {
  NOTIFICATION_SENDERS,
  type NotificationSender,
} from './senders/notification-sender.interface';

/** The delivery payload carried through the queue — contact details are
 *  resolved at delivery time so a delayed/retried job uses fresh data. */
export interface QueuedNotification {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
}

/**
 * Resolves the recipient and pushes a notification to every delivery channel.
 * Called by the queue worker (production) or inline (tests / Redis outage).
 * Each sender failure is isolated so one bad channel never blocks the others.
 */
@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(
    private readonly repo: NotificationsRepository,
    @Inject(NOTIFICATION_SENDERS)
    private readonly senders: NotificationSender[],
  ) {}

  async deliver(base: QueuedNotification): Promise<void> {
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
}
