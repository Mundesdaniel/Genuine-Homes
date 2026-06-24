import { UserRole } from '@genuine-homes/shared';

/** Roles allowed to own and manage properties/listings — tenants cannot. */
export const SELLER_ROLES = [
  UserRole.LANDLORD,
  UserRole.AGENT,
  UserRole.DEVELOPER,
  UserRole.ADMIN,
];
