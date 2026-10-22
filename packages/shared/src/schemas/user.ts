/**
 * User profile contracts. Self-service profile edits (name/email) plus the
 * admin-only fields (role, verified). Phone is the primary identifier in
 * Uganda and is not editable here — changing it would be an account-recovery
 * flow of its own.
 */

import { z } from 'zod';
import { UserRole, enumValues } from '../enums';
import type { UserRole as UserRoleType } from '../enums';
import { STAFF_ASSIGNABLE_ROLES, phoneSchema } from './auth';

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    // Pass null to clear the email; omit to leave unchanged.
    email: z.string().trim().email().max(254).nullable().optional(),
  })
  .refine((v) => v.fullName !== undefined || v.email !== undefined, {
    message: 'Provide at least one field to update',
  });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const adminUpdateUserSchema = z
  .object({
    role: z.enum(enumValues(UserRole)).optional(),
    isVerified: z.boolean().optional(),
  })
  .refine((v) => v.role !== undefined || v.isVerified !== undefined, {
    message: 'Provide at least one field to update',
  });
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;

/**
 * Admin-only: create a staff account (agent/landlord/manager) directly. The new
 * account has no password until the recipient sets one via the invitation link.
 */
export const createStaffUserSchema = z.object({
  fullName: z.string().trim().min(2, 'Name is too short').max(120),
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().email().max(254).optional(),
  role: z.enum(STAFF_ASSIGNABLE_ROLES),
});
export type CreateStaffUserInput = z.infer<typeof createStaffUserSchema>;

export interface StaffUserCreatedResponse {
  user: UserProfileResponse;
  /**
   * Single-use link the new staff member uses to set their password. Returned
   * directly (not emailed) because the project has no email service — an admin
   * shares it out-of-band.
   */
  invitationLink: string;
}

export interface UserProfileResponse {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  role: UserRoleType;
  isVerified: boolean;
  /** Set when an admin approved the user's National ID (KYC) submission.
   *  Sellers need this before a property can be published (`active`). */
  identityVerifiedAt: string | null;
  createdAt: string;
}
