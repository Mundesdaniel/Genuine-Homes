import type { PasswordResetToken, RefreshToken, User } from '@prisma/client';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@genuine-homes/shared';
import { AuthService } from './auth.service';
import type { AuthRepository } from './auth.repository';
import { TokenService } from './token.service';
import type { Env } from '../config/env.validation';
import type { NotificationsService } from '../notifications/notifications.service';

/**
 * In-memory stand-in for AuthRepository so the service can be tested without a
 * database. Only the fields the service touches are modelled.
 */
class FakeRepo {
  users = new Map<string, User>();
  tokens: RefreshToken[] = [];
  resetTokens: PasswordResetToken[] = [];
  private seq = 0;

  async findActiveByEmailOrPhone(identifier: string): Promise<User | null> {
    for (const u of this.users.values()) {
      if (u.deletedAt) continue;
      if (u.email === identifier || u.phone === identifier) return u;
    }
    return null;
  }
  async findActiveById(id: string): Promise<User | null> {
    const u = this.users.get(id);
    return u && !u.deletedAt ? u : null;
  }
  async phoneExists(phone: string): Promise<boolean> {
    return [...this.users.values()].some((u) => u.phone === phone);
  }
  async emailExists(email: string): Promise<boolean> {
    return [...this.users.values()].some((u) => u.email === email);
  }
  async createUser(data: {
    fullName: string;
    phone: string;
    email: string | null;
    passwordHash: string;
    role: UserRole;
  }): Promise<User> {
    const u = {
      id: `user-${++this.seq}`,
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...data,
    } as User;
    this.users.set(u.id, u);
    return u;
  }
  async createRefreshToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    const t = {
      id: `tok-${++this.seq}`,
      revokedAt: null,
      createdAt: new Date(),
      ...data,
    } as RefreshToken;
    this.tokens.push(t);
    return t;
  }
  async findRefreshByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.tokens.find((t) => t.tokenHash === tokenHash) ?? null;
  }
  async revokeRefreshToken(id: string): Promise<void> {
    const t = this.tokens.find((x) => x.id === id);
    if (t) t.revokedAt = new Date();
  }
  async revokeAllForUser(userId: string): Promise<void> {
    for (const t of this.tokens) {
      if (t.userId === userId && !t.revokedAt) t.revokedAt = new Date();
    }
  }
  async createResetToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<PasswordResetToken> {
    const t = {
      id: `reset-${++this.seq}`,
      usedAt: null,
      createdAt: new Date(),
      ...data,
    } as PasswordResetToken;
    this.resetTokens.push(t);
    return t;
  }
  async findResetTokenByHash(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.resetTokens.find((t) => t.tokenHash === tokenHash) ?? null;
  }
  async invalidateResetTokensForUser(userId: string): Promise<void> {
    for (const t of this.resetTokens) {
      if (t.userId === userId && !t.usedAt) t.usedAt = new Date();
    }
  }
  async consumeResetToken(
    tokenId: string,
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    const user = this.users.get(userId);
    if (user) user.passwordHash = passwordHash;
    const t = this.resetTokens.find((x) => x.id === tokenId);
    if (t) t.usedAt = new Date();
    await this.revokeAllForUser(userId);
  }
}

/** Captures outbound messages so tests can pull the reset link out. */
class FakeNotifications {
  sent: { userId: string; body: string }[] = [];
  async dispatch(userId: string, _type: string, _title: string, body: string) {
    this.sent.push({ userId, body });
  }
}

// Test config — secrets just need to be long enough; TTLs are real formats.
const ENV: Record<string, string> = {
  JWT_ACCESS_SECRET: 'access-secret-that-is-at-least-32-chars-long',
  JWT_ACCESS_TTL: '900s',
  JWT_REFRESH_SECRET: 'refresh-secret-that-is-at-least-32-chars-long',
  JWT_REFRESH_TTL: '30d',
  CORS_ORIGINS: 'http://localhost:5173',
};
const fakeConfig = {
  get: (key: string) => ENV[key],
} as unknown as ConfigService<Env, true>;

const validRegister = {
  fullName: 'David Okello',
  phone: '+256700000003',
  email: 'David@Example.ug',
  password: 'Password123!',
  role: UserRole.USER,
};

describe('AuthService', () => {
  let repo: FakeRepo;
  let notifications: FakeNotifications;
  let service: AuthService;

  beforeEach(() => {
    repo = new FakeRepo();
    notifications = new FakeNotifications();
    const tokens = new TokenService(new JwtService({}), fakeConfig);
    service = new AuthService(
      repo as unknown as AuthRepository,
      tokens,
      notifications as unknown as NotificationsService,
      fakeConfig,
    );
  });

  describe('register', () => {
    it('creates a user and returns a token pair without the password hash', async () => {
      const res = await service.register(validRegister);

      expect(res.user.id).toBeDefined();
      expect(res.user.role).toBe(UserRole.USER);
      // Email is normalised to lowercase.
      expect(res.user.email).toBe('david@example.ug');
      expect(res.accessToken).toEqual(expect.any(String));
      expect(res.refreshToken).toEqual(expect.any(String));
      expect(res.tokenType).toBe('Bearer');
      expect(res.expiresIn).toBe(900);
      expect(
        (res.user as unknown as Record<string, unknown>).passwordHash,
      ).toBeUndefined();
      // The refresh token is persisted only as a hash, never raw.
      expect(repo.tokens).toHaveLength(1);
      expect(repo.tokens[0]?.tokenHash).not.toBe(res.refreshToken);
    });

    it('rejects a duplicate phone number', async () => {
      await service.register(validRegister);
      await expect(
        service.register({ ...validRegister, email: 'other@example.ug' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    beforeEach(() => service.register(validRegister));

    it('logs in with the phone number', async () => {
      const res = await service.login({
        emailOrPhone: '+256700000003',
        password: 'Password123!',
      });
      expect(res.accessToken).toEqual(expect.any(String));
    });

    it('logs in with the email case-insensitively', async () => {
      const res = await service.login({
        emailOrPhone: 'DAVID@example.ug',
        password: 'Password123!',
      });
      expect(res.user.email).toBe('david@example.ug');
    });

    it('rejects a wrong password', async () => {
      await expect(
        service.login({ emailOrPhone: '+256700000003', password: 'wrong-pass1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an unknown account', async () => {
      await expect(
        service.login({ emailOrPhone: '+256999999999', password: 'Password123!' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token and invalidates the old one', async () => {
      const first = await service.register(validRegister);
      const second = await service.refresh(first.refreshToken);

      // A brand-new, different refresh token is issued.
      expect(second.refreshToken).not.toBe(first.refreshToken);

      // The new one works...
      const third = await service.refresh(second.refreshToken);
      expect(third.accessToken).toEqual(expect.any(String));
    });

    it('detects reuse of a rotated token and revokes every session', async () => {
      const first = await service.register(validRegister);
      const second = await service.refresh(first.refreshToken);

      // Replaying the already-rotated token is treated as theft.
      await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      // ...and that nukes the still-"valid" token too.
      await expect(service.refresh(second.refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a garbage refresh token', async () => {
      await expect(service.refresh('not-a-jwt')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('revokes the session so the token can no longer refresh', async () => {
      const session = await service.register(validRegister);
      await service.logout(session.refreshToken);
      await expect(service.refresh(session.refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('succeeds silently for an invalid token', async () => {
      await expect(service.logout('not-a-jwt')).resolves.toBeUndefined();
    });
  });

  describe('forgotPassword / resetPassword', () => {
    beforeEach(() => service.register(validRegister));

    // The raw token only exists inside the delivered link — dig it back out.
    const sentToken = (): string => {
      const body = notifications.sent.at(-1)?.body ?? '';
      return /token=([A-Za-z0-9_-]+)/.exec(body)?.[1] ?? '';
    };

    it('sends a reset link and stores only the token hash', async () => {
      const res = await service.forgotPassword({ emailOrPhone: '+256700000003' });
      expect(res).toEqual({ success: true });
      expect(notifications.sent).toHaveLength(1);
      const token = sentToken();
      expect(token.length).toBeGreaterThanOrEqual(20);
      expect(repo.resetTokens).toHaveLength(1);
      expect(repo.resetTokens[0]?.tokenHash).not.toBe(token);
    });

    it('reports success for an unknown identifier without sending anything', async () => {
      const res = await service.forgotPassword({ emailOrPhone: 'nobody@example.ug' });
      expect(res).toEqual({ success: true });
      expect(notifications.sent).toHaveLength(0);
      expect(repo.resetTokens).toHaveLength(0);
    });

    it('resets the password, revokes sessions, and burns the token', async () => {
      const session = await service.login({
        emailOrPhone: '+256700000003',
        password: 'Password123!',
      });
      await service.forgotPassword({ emailOrPhone: '+256700000003' });
      const token = sentToken();

      await expect(
        service.resetPassword({ token, password: 'NewPassword456!' }),
      ).resolves.toEqual({ success: true });

      // New password works; the old one no longer does.
      await expect(
        service.login({ emailOrPhone: '+256700000003', password: 'NewPassword456!' }),
      ).resolves.toBeDefined();
      await expect(
        service.login({ emailOrPhone: '+256700000003', password: 'Password123!' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      // Every pre-reset session is dead.
      await expect(service.refresh(session.refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      // The token is single-use.
      await expect(
        service.resetPassword({ token, password: 'AnotherPass789!' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('only honours the most recently issued link', async () => {
      await service.forgotPassword({ emailOrPhone: '+256700000003' });
      const firstToken = sentToken();
      await service.forgotPassword({ emailOrPhone: '+256700000003' });

      await expect(
        service.resetPassword({ token: firstToken, password: 'NewPassword456!' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a garbage token', async () => {
      await expect(
        service.resetPassword({
          token: 'definitely-not-a-real-token-value',
          password: 'NewPassword456!',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an expired token', async () => {
      await service.forgotPassword({ emailOrPhone: '+256700000003' });
      const token = sentToken();
      const stored = repo.resetTokens[0];
      if (stored) stored.expiresAt = new Date(Date.now() - 1000);

      await expect(
        service.resetPassword({ token, password: 'NewPassword456!' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
