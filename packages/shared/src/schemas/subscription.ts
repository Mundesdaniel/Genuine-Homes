/**
 * AirBnB-agent subscription contracts. Subscriptions are cash-billed and
 * managed by an admin; an active, unexpired subscription (plus the
 * `airbnb_agent` role) is what gates access to the short-let dashboard.
 */

import { z } from 'zod';
import type {
  SubscriptionRequestStatus as SubscriptionRequestStatusType,
  SubscriptionStatus as SubscriptionStatusType,
} from '../enums';

export const SUBSCRIPTION = {
  PLAN_MAX: 80,
  MESSAGE_MAX: 300,
} as const;

/**
 * Admin records a cash subscription payment and activates it for a date range.
 * `expiresAt` must be after `startsAt`.
 */
export const recordSubscriptionPaymentSchema = z
  .object({
    userId: z.string().uuid(),
    plan: z.string().trim().min(1, 'Choose a plan').max(SUBSCRIPTION.PLAN_MAX),
    startsAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  })
  .refine((v) => new Date(v.expiresAt) > new Date(v.startsAt), {
    message: 'Expiry must be after the start date',
    path: ['expiresAt'],
  });
export type RecordSubscriptionPaymentInput = z.infer<typeof recordSubscriptionPaymentSchema>;

export interface SubscriptionResponse {
  id: string;
  userId: string;
  plan: string;
  status: SubscriptionStatusType;
  startsAt: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  /** Account context for the admin list (avoids a second lookup). */
  user: { id: string; fullName: string; phone: string; email: string | null } | null;
}

/** A user asks to subscribe as an AirBnB agent — lands in the admin queue. */
export const createSubscriptionRequestSchema = z.object({
  plan: z.string().trim().min(1, 'Choose a plan').max(SUBSCRIPTION.PLAN_MAX),
  message: z.string().trim().max(SUBSCRIPTION.MESSAGE_MAX).optional(),
});
export type CreateSubscriptionRequestInput = z.infer<typeof createSubscriptionRequestSchema>;

/** Admin approves a request: records the subscription for a date range + grants the role. */
export const approveSubscriptionRequestSchema = z
  .object({
    startsAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  })
  .refine((v) => new Date(v.expiresAt) > new Date(v.startsAt), {
    message: 'Expiry must be after the start date',
    path: ['expiresAt'],
  });
export type ApproveSubscriptionRequestInput = z.infer<typeof approveSubscriptionRequestSchema>;

export interface SubscriptionRequestResponse {
  id: string;
  userId: string;
  plan: string;
  message: string | null;
  status: SubscriptionRequestStatusType;
  createdAt: string;
  updatedAt: string;
  user: { id: string; fullName: string; phone: string; email: string | null } | null;
}
