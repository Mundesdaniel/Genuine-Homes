/**
 * Review contracts. Reviews target a person (agent/landlord/developer), not a
 * property — buyers rate who they dealt with. One review per author per target
 * (a repeat submission updates the existing one).
 */

import { z } from 'zod';

export const REVIEW = {
  MIN_RATING: 1,
  MAX_RATING: 5,
  MAX_COMMENT: 1000,
} as const;

export const createReviewSchema = z.object({
  targetId: z.string().uuid(),
  rating: z.coerce.number().int().min(REVIEW.MIN_RATING).max(REVIEW.MAX_RATING),
  comment: z.string().trim().max(REVIEW.MAX_COMMENT).optional(),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export interface ReviewResponse {
  id: string;
  rating: number;
  comment: string | null;
  author: { id: string; fullName: string };
  createdAt: string;
}

/** Aggregate rating for a target, for badges and profile headers. */
export interface ReviewSummary {
  targetId: string;
  average: number;
  count: number;
}
