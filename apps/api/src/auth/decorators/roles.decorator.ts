import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@genuine-homes/shared';

// Restricts a route to the listed roles — enforced by RolesGuard.
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
