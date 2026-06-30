/**
 * Property verification contracts. An owner submits ownership/title documents
 * for a property; an admin reviews and approves or rejects, which drives the
 * "Verified" badge (property.verificationStatus). Documents should live in
 * private storage with signed URLs — only the URL reference is stored here.
 */

import { z } from 'zod';
import type { VerificationStatus as VerificationStatusType } from '../enums';

export const VERIFICATION = {
  MAX_DOCUMENTS: 10,
  MAX_NOTES: 1000,
} as const;

export const verificationDocumentSchema = z.object({
  /** e.g. 'land_title', 'national_id', 'sale_agreement'. */
  kind: z.string().trim().min(1).max(60),
  url: z.string().url().max(2048),
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

export interface VerificationDocument {
  kind: string;
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
