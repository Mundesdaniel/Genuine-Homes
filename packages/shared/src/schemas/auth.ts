/**
 * Authentication contracts shared between the NestJS API and the web/mobile
 * clients.
 *
 * The Zod schemas are the single source of truth for request validation: the
 * frontend parses forms with them and the backend mirrors the same rules in its
 * class-validator DTOs (keeping the two in lockstep). The exported types are
 * used by both sides for request/response payloads.
 */

import { z } from 'zod';
import { UserRole } from '../enums';

/**
 * Roles a person may pick when registering themselves. `admin` is deliberately
 * excluded — it can only be granted by another admin, never self-assigned.
 */
export const SELF_ASSIGNABLE_ROLES = [
  UserRole.USER,
  UserRole.LANDLORD,
  UserRole.AGENT,
  UserRole.DEVELOPER,
] as const;
export type SelfAssignableRole = (typeof SELF_ASSIGNABLE_ROLES)[number];

/** International phone number (E.164-ish). Uganda numbers look like +2567XXXXXXXX. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^\+?[1-9]\d{7,14}$/,
    'Enter a valid phone number in international format, e.g. +256700000000',
  );

/** At least 8 chars with one letter and one digit. */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Name is too short').max(120),
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().email().max(254).optional(),
  password: passwordSchema,
  role: z.enum(SELF_ASSIGNABLE_ROLES).default(UserRole.USER),
});
/** Server-side shape (role defaulted). Use `RegisterRequest` for the wire form. */
export type RegisterInput = z.infer<typeof registerSchema>;
/** Client-side / request shape — `role` is optional before the default applies. */
export type RegisterRequest = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  /** Either the email or the phone the account was registered with. */
  emailOrPhone: z.string().trim().min(3, 'Enter your email or phone'),
  password: z.string().min(1, 'Enter your password'),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Browsers carry the refresh token in the httpOnly `gh_refresh` cookie, so
 *  the body token is optional — it exists for non-browser clients (the future
 *  mobile app, scripts) that manage tokens themselves. */
export const refreshSchema = z.object({
  refreshToken: z.string().min(10).optional(),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const logoutSchema = refreshSchema;
export type LogoutInput = z.infer<typeof logoutSchema>;

/** The authenticated user as returned to clients — never includes the hash. */
export interface AuthUser {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  role: UserRole;
  isVerified: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Access-token lifetime in seconds (clients refresh before this elapses). */
  expiresIn: number;
}

export interface AuthResponse extends AuthTokens {
  user: AuthUser;
}
