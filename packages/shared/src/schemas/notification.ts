/**
 * Notification contracts shared by the API and clients.
 *
 * The database stores the human-readable `title`/`body` plus any reference ids
 * inside the `payload` jsonb column (the table has no dedicated text columns).
 * The API flattens that into this response shape at the mapping boundary so
 * clients get a stable, typed object regardless of how payloads evolve.
 */

import type { NotificationType as NotificationTypeType } from '../enums';

export interface NotificationResponse {
  id: string;
  type: NotificationTypeType;
  title: string;
  body: string;
  /** Reference ids (planId, installmentId, listingId, …) for client deep-links. */
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

/** Count of unread notifications — drives the header bell badge. */
export interface UnreadCountResponse {
  unread: number;
}
