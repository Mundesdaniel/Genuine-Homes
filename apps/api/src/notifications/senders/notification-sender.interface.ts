import type { NotificationType } from '@genuine-homes/shared';

/**
 * Delivery channel abstraction (Strategy). Each settled in-app notification is
 * fanned out to every registered sender — log now, SMS (Africa's Talking) and
 * push (FCM) later — without the notifications service knowing the details.
 */
export const NOTIFICATION_SENDERS = Symbol('NOTIFICATION_SENDERS');

export interface OutboundNotification {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Recipient contact details, resolved from the user record. */
  phone: string;
  email: string | null;
}

export interface NotificationSender {
  /** Stable channel name for logs/metrics (e.g. 'log', 'sms', 'push'). */
  readonly channel: string;
  send(notification: OutboundNotification): Promise<void>;
}
