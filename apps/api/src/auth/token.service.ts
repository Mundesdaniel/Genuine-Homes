import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { UserRole } from '@genuine-homes/shared';
import type { Env } from '../config/env.validation';
import type { AccessTokenPayload, RefreshTokenPayload } from './types/jwt-payload';

/**
 * Owns all JWT signing/verifying and refresh-token hashing. Keeping this in one
 * place means the access and refresh secrets are read from config in exactly
 * one spot and the rest of the auth code stays free of crypto details.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // Sign a short-lived access token; returns its lifetime in seconds for clients.
  async signAccess(user: {
    id: string;
    role: UserRole;
  }): Promise<{ token: string; expiresIn: number }> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      role: user.role,
      type: 'access',
    };
    const token = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
    });
    // Derive expiresIn straight from the token so it is exact for any TTL format.
    const { iat, exp } = this.jwt.decode<{ iat: number; exp: number }>(token);
    return { token, expiresIn: exp - iat };
  }

  // Sign a rotating refresh token; the jti makes it unique so its hash is too.
  async signRefresh(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const payload: RefreshTokenPayload = {
      sub: userId,
      jti: randomUUID(),
      type: 'refresh',
    };
    const token = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      expiresIn: this.config.get('JWT_REFRESH_TTL', { infer: true }),
    });
    const { exp } = this.jwt.decode<{ exp: number }>(token);
    return { token, expiresAt: new Date(exp * 1000) };
  }

  // Throws if the access token is invalid/expired or signed with another secret.
  verifyAccess(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync<AccessTokenPayload>(token, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  verifyRefresh(token: string): Promise<RefreshTokenPayload> {
    return this.jwt.verifyAsync<RefreshTokenPayload>(token, {
      secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
    });
  }

  // Deterministic hash stored in the DB — lets us look a refresh token up by
  // hash (so the raw token never touches the database) and revoke it.
  hashRefresh(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // When the refresh token stops verifying — aligns the httpOnly cookie's
  // lifetime with the token it carries.
  refreshExpiry(token: string): Date {
    const { exp } = this.jwt.decode<{ exp: number }>(token);
    return new Date(exp * 1000);
  }
}
