/**
 * Chat contracts. Clients SEND messages over REST (so they reuse the same
 * validation as everything else) and RECEIVE them over a WebSocket push. A
 * "conversation" is derived from messages between two people — there is no
 * separate conversation table.
 */

import { z } from 'zod';

export const CHAT = { MAX_BODY: 2000 } as const;

export const sendMessageSchema = z.object({
  receiverId: z.string().uuid(),
  /** Optional listing the conversation is about (deep-link context). */
  listingId: z.string().uuid().optional(),
  body: z.string().trim().min(1).max(CHAT.MAX_BODY),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export interface MessageResponse {
  id: string;
  senderId: string;
  receiverId: string;
  listingId: string | null;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface ConversationSummary {
  partner: { id: string; fullName: string };
  lastMessage: string;
  lastAt: string;
  unread: number;
}

/** WebSocket event name the server pushes a new message on. */
export const CHAT_MESSAGE_EVENT = 'chat:message';
