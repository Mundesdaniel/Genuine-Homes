/**
 * User profile contracts. Self-service profile edits (name/email) plus the
 * admin-only fields (role, verified). Phone is the primary identifier in
 * Uganda and is not editable here — changing it would be an account-recovery
 * flow of its own.
 */

import { z } from 'zod';
import { UserRole, enumValues } from '../enums';
import type { UserRole as UserRoleType } from '../enums';

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

export interface UserProfileResponse {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  role: UserRoleType;
  isVerified: boolean;
  createdAt: string;
}
