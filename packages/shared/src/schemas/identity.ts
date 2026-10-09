/**
 * Identity (KYC) verification contracts. A seller (landlord/agent/developer)
 * submits their Ugandan National ID (NIN) details plus document photos; an
 * admin reviews and approves or rejects. Approval stamps
 * `user.identityVerifiedAt`, which gates publishing a property (setting it
 * `active`). Developers are companies, so their submission also carries KYB
 * fields (URSB registration + TIN) with the NIN belonging to the authorized
 * representative.
 *
 * The NIN itself is identity *proofing*, never an authentication factor. The
 * API stores only a masked form (last 4) plus an HMAC hash for duplicate
 * detection — the raw number is not persisted. ID documents live in private
 * storage (keys from `POST /uploads/documents`) and are only ever served via
 * short-lived signed URLs.
 */

import { z } from 'zod';
import { verificationDocumentSchema } from './verification';
import type { VerificationDocument, VerificationDocumentInput } from './verification';
import type { VerificationStatus as VerificationStatusType } from '../enums';

export const IDENTITY = {
  /**
   * Ugandan NINs are 14 characters: two leading letters (e.g. CM/CF for
   * citizens) followed by 12 alphanumerics. Uppercased before validation.
   */
  NIN_PATTERN: /^[A-Z]{2}[A-Z0-9]{12}$/,
  NIN_LENGTH: 14,
  /** ID front/back, selfie, plus company docs for developers. */
  MAX_DOCUMENTS: 6,
  MAX_NOTES: 1000,
} as const;

const ninSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .pipe(z.string().length(IDENTITY.NIN_LENGTH).regex(IDENTITY.NIN_PATTERN, 'Invalid NIN'));

export const submitIdentityVerificationSchema = z.object({
  legalName: z.string().trim().min(2).max(120),
  nin: ninSchema,
  documents: z
    .array(verificationDocumentSchema)
    .min(1)
    .max(IDENTITY.MAX_DOCUMENTS),
  // KYB fields — required for developers (companies), enforced server-side.
  organizationName: z.string().trim().min(2).max(160).optional(),
  registrationNumber: z.string().trim().min(2).max(60).optional(),
  tin: z.string().trim().min(2).max(30).optional(),
});
export type SubmitIdentityVerificationInput = z.infer<
  typeof submitIdentityVerificationSchema
>;

export const reviewIdentityVerificationSchema = z.object({
  decision: z.enum(['verified', 'rejected']),
  notes: z.string().trim().max(IDENTITY.MAX_NOTES).optional(),
});
export type ReviewIdentityVerificationInput = z.infer<
  typeof reviewIdentityVerificationSchema
>;

export type IdentityDocumentInput = VerificationDocumentInput;

export interface IdentityVerificationResponse {
  id: string;
  userId: string;
  legalName: string;
  /** e.g. `**********1234` — the full NIN is never returned (or stored). */
  ninMasked: string;
  organizationName: string | null;
  registrationNumber: string | null;
  tin: string | null;
  status: VerificationStatusType;
  documents: VerificationDocument[];
  notes: string | null;
  reviewerId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Admin queue rows carry the subject's name/role for review context. */
export interface IdentityVerificationQueueItem extends IdentityVerificationResponse {
  userFullName: string;
  userRole: string;
}
