/**
 * Property verification contracts. An owner submits ownership/title documents
 * for a property; an admin reviews and approves or rejects, which drives the
 * "Verified" badge (property.verificationStatus). Documents live in private
 * storage: submissions reference the opaque storage `key` returned by
 * `POST /uploads/documents`, and responses expose short-lived signed URLs —
 * the raw file is never publicly addressable.
 */

import { z } from 'zod';
import { DOCUMENT_UPLOAD } from '../constants';
import type { VerificationStatus as VerificationStatusType } from '../enums';

export const VERIFICATION = {
  MAX_DOCUMENTS: 10,
  MAX_NOTES: 1000,
} as const;

export const verificationDocumentSchema = z.object({
  /** e.g. 'land_title', 'national_id', 'sale_agreement'. */
  kind: z.string().trim().min(1).max(60),
  /** Private-storage key from `POST /uploads/documents` (`<uuid>.<ext>`). */
  key: z.string().regex(DOCUMENT_UPLOAD.KEY_PATTERN, 'Invalid document key'),
});
export type VerificationDocumentInput = z.infer<typeof verificationDocumentSchema>;

export const submitVerificationSchema = z.object({
  propertyId: z.string().uuid(),
  documents: z.array(verificationDocumentSchema).min(1).max(VERIFICATION.MAX_DOCUMENTS),
});
export type SubmitVerificationInput = z.infer<typeof submitVerificationSchema>;

export const reviewVerificationSchema = z.object({
  decision: z.enum(['verified', 'rejected']),
  notes: z.string().trim().max(VERIFICATION.MAX_NOTES).optional(),
});
export type ReviewVerificationInput = z.infer<typeof reviewVerificationSchema>;

/** Result of uploading to `POST /uploads/documents`: the private-storage key
 *  a verification submission references (no URL — the file is not public). */
export interface DocumentUploadResponse {
  key: string;
}

export interface VerificationDocument {
  kind: string;
  /** Signed, expiring link (relative `/api/...` path) — mint a fresh response
   *  rather than persisting this anywhere. */
  url: string;
  uploadedAt: string;
}

export interface VerificationResponse {
  id: string;
  propertyId: string;
  propertyTitle: string;
  status: VerificationStatusType;
  documents: VerificationDocument[];
  notes: string | null;
  reviewerId: string | null;
  createdAt: string;
  updatedAt: string;
}
