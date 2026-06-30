import { Logger } from '@nestjs/common';
import type {
  NotificationSender,
  OutboundNotification,
} from './notification-sender.interface';

/**
 * Default sender: writes the notification to the application log. Always
 * registered so every environment has a working delivery path even before SMS
 * or push credentials are configured.
 */
export class LogNotificationSender implements NotificationSender {
  readonly channel = 'log';
  private readonly logger = new Logger('Notification');

  async send(notification: OutboundNotification): Promise<void> {
    this.logger.log(
      `[${notification.type}] → user ${notification.userId}: ${notification.title} — ${notification.body}`,
    );
  }
}
