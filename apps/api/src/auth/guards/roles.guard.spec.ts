import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../types/jwt-payload';
import { RolesGuard } from './roles.guard';

// Build a fake ExecutionContext carrying the given user on the request.
const contextWith = (user?: AuthenticatedUser): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  // Stub the reflector to return a fixed @Roles() requirement.
  const guardRequiring = (roles?: UserRole[]): RolesGuard => {
    const reflector = { getAllAndOverride: () => roles } as unknown as Reflector;
    return new RolesGuard(reflector);
  };

  it('allows any request when no @Roles is set', () => {
    expect(guardRequiring(undefined).canActivate(contextWith())).toBe(true);
  });

  it('allows a user whose role is permitted', () => {
    const ctx = contextWith({ id: 'u1', role: UserRole.ADMIN });
    expect(guardRequiring([UserRole.ADMIN]).canActivate(ctx)).toBe(true);
  });

  it('blocks a user whose role is not permitted', () => {
    const ctx = contextWith({ id: 'u1', role: UserRole.USER });
    expect(() => guardRequiring([UserRole.ADMIN]).canActivate(ctx)).toThrow(
      ForbiddenException,
    );
  });

  it('blocks when no user is present', () => {
    expect(() => guardRequiring([UserRole.ADMIN]).canActivate(contextWith())).toThrow(
      ForbiddenException,
    );
  });
});
