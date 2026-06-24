import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import {
  type AuthResponse,
  type AuthUser,
  UserRole,
} from '@genuine-homes/shared';
import { AuthRepository } from './auth.repository';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // A throwaway hash to verify against when no user is found, so login takes
  // the same time whether or not the account exists (blocks user enumeration).
  private readonly decoyHash = argonHash('decoy-password-for-constant-time');

  constructor(
    private readonly repo: AuthRepository,
    private readonly tokens: TokenService,
  ) {}

  // Create an account, then immediately log the user in.
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const phone = dto.phone.trim();
    const email = dto.email?.trim().toLowerCase() ?? null;

    // Pre-check for friendly errors; the DB unique constraints are the real guard.
    if (await this.repo.phoneExists(phone)) {
      throw new ConflictException('Phone number is already registered');
    }
    if (email && (await this.repo.emailExists(email))) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await argonHash(dto.password);
    const user = await this.repo.createUser({
      fullName: dto.fullName.trim(),
      phone,
      email,
      passwordHash,
      role: dto.role ?? UserRole.USER,
    });

    this.logger.log(`Registered user ${user.id} (${user.role})`);
    return this.issueSession(user);
  }

  // Verify credentials and start a session. Errors are deliberately generic.
  async login(dto: LoginDto): Promise<AuthResponse> {
    const identifier = dto.emailOrPhone.trim().toLowerCase();
    const user = await this.repo.findActiveByEmailOrPhone(identifier);

    // Always run a verify (decoy when no user) to keep timing constant.
    const ok = await argonVerify(
      user?.passwordHash ?? (await this.decoyHash),
      dto.password,
    );
    if (!user || !ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueSession(user);
  }

  /**
   * Rotate a refresh token: validate it, revoke it, and issue a fresh pair.
   * If a refresh token is replayed after rotation we treat it as a stolen-token
   * event and revoke every session for that user.
   */
  async refresh(refreshToken: string): Promise<AuthResponse> {
    let payload;
    try {
      payload = await this.tokens.verifyRefresh(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const stored = await this.repo.findRefreshByHash(
      this.tokens.hashRefresh(refreshToken),
    );
    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    // Already-rotated token presented again → likely theft. Burn all sessions.
    if (stored.revokedAt) {
      this.logger.warn(`Refresh token reuse detected for user ${stored.userId}`);
      await this.repo.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    if (stored.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.repo.findActiveById(stored.userId);
    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }

    await this.repo.revokeRefreshToken(stored.id);
    return this.issueSession(user);
  }

  // Revoke the given session. Idempotent — never reveals whether it was valid.
  async logout(refreshToken: string): Promise<void> {
    try {
      await this.tokens.verifyRefresh(refreshToken);
    } catch {
      return; // Garbage/expired token: nothing to revoke, succeed silently.
    }
    const stored = await this.repo.findRefreshByHash(
      this.tokens.hashRefresh(refreshToken),
    );
    if (stored && !stored.revokedAt) {
      await this.repo.revokeRefreshToken(stored.id);
    }
  }

  // The current user's public profile.
  async me(userId: string): Promise<AuthUser> {
    const user = await this.repo.findActiveById(userId);
    if (!user) throw new UnauthorizedException('Account no longer exists');
    return this.toAuthUser(user);
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  // Mint an access + refresh pair and persist the refresh token's hash.
  private async issueSession(user: User): Promise<AuthResponse> {
    const access = await this.tokens.signAccess({
      id: user.id,
      role: user.role,
    });
    const refresh = await this.tokens.signRefresh(user.id);
    await this.repo.createRefreshToken({
      userId: user.id,
      tokenHash: this.tokens.hashRefresh(refresh.token),
      expiresAt: refresh.expiresAt,
    });

    return {
      user: this.toAuthUser(user),
      accessToken: access.token,
      refreshToken: refresh.token,
      tokenType: 'Bearer',
      expiresIn: access.expiresIn,
    };
  }

  // Strip the password hash and shape the user for API responses.
  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
