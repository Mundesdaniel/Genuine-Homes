import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';
import type {
  NotificationSender,
  OutboundNotification,
} from './notification-sender.interface';

/**
 * SMS delivery via Africa's Talking. Registered only when credentials are
 * present (see NotificationsModule). The live HTTP send is intentionally left
 * as a documented integration point: it logs the SMS it *would* send so the
 * delivery fan-out is exercised end-to-end without a network dependency or
 * incurring SMS costs in dev/test. Swap the body of `deliver()` for a real
 * Africa's Talking call when going live.
 */
export class SmsNotificationSender implements NotificationSender {
  readonly channel = 'sms';
  private readonly logger = new Logger('NotificationSms');

  constructor(private readonly config: ConfigService<Env, true>) {}

  async send(notification: OutboundNotification): Promise<void> {
    // Reminders and payment alerts are the high-value SMS in the Ugandan
    // market; everything else stays in-app to keep SMS spend down.
    await this.deliver(notification.phone, `${notification.title}: ${notification.body}`);
  }

  private async deliver(to: string, text: string): Promise<void> {
    const username = this.config.get('AFRICASTALKING_USERNAME', { infer: true });
    this.logger.log(`(stub) SMS via Africa's Talking [${username ?? 'sandbox'}] → ${to}: ${text}`);
  }
}
