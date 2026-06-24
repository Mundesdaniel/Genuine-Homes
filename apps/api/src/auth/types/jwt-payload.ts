import type { UserRole } from '@genuine-homes/shared';

/**
 * JWT payloads. `type` discriminates the two token kinds so an access token can
 * never be replayed where a refresh token is expected (and vice versa).
 */

// Short-lived token sent on every API call as `Authorization: Bearer <token>`.
export interface AccessTokenPayload {
  sub: string; // user id
  role: UserRole;
  type: 'access';
  iat?: number;
  exp?: number;
}

// Long-lived token used only to mint new access tokens; rotated on each use.
export interface RefreshTokenPayload {
  sub: string; // user id
  jti: string; // unique id — makes every refresh token distinct + hashable
  type: 'refresh';
  iat?: number;
  exp?: number;
}

// What guards attach to `req.user` after authenticating a request.
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}
