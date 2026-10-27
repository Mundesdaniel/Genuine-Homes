import { UserRole } from '@genuine-homes/shared';

/** Roles allowed to own and manage properties/listings — tenants cannot. */
export const SELLER_ROLES = [UserRole.AGENT, UserRole.MANAGER, UserRole.ADMIN];
