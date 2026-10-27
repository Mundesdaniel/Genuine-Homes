import { randomBytes } from 'node:crypto';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import {
  type AuthResponse,
  type AuthUser,
  type CreateStaffUserInput,
  NotificationType,
  type StaffUserCreatedResponse,
  UserRole,
} from '@genuine-homes/shared';
import { mapUserProfile } from '../common/mappers';
import type { Env } from '../config/env.validation';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthRepository } from './auth.repository';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import { TokenService } from './token.service';

/** How long a password-reset link stays valid. */
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

/** How long a staff set-password invitation link stays valid (7 days). */
const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // A throwaway hash to verify against when no user is found, so login takes
  // the same time whether or not the account exists (blocks user enumeration).
  private readonly decoyHash = argonHash('decoy-password-for-constant-time');

  constructor(
    private readonly repo: AuthRepository,
    private readonly tokens: TokenService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService<Env, true>,
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
    // Self-registration always creates a plain user. Any `role` on the request is
    // ignored here — elevated roles (agent/manager) are invite-only and
    // created by an admin via adminCreateUser.
    const user = await this.repo.createUser({
      fullName: dto.fullName.trim(),
      phone,
      email,
      passwordHash,
      role: UserRole.USER,
    });

    this.logger.log(`Registered user ${user.id} (${user.role})`);
    return this.issueSession(user);
  }

  /**
   * Admin-only: create a staff account (agent/manager) directly. The
   * account gets a random, unknowable password; the recipient sets their own via
   * a single-use invitation link built on the same machinery as a password reset
   * (longer-lived). The project has no email service, so the link is returned to
   * the caller to deliver out-of-band rather than being sent automatically.
   *
   * The role is constrained to the staff roles by validation upstream — this
   * endpoint can never mint a `user` (that's self-registration) or an `admin`.
   */
  async adminCreateUser(dto: CreateStaffUserInput): Promise<StaffUserCreatedResponse> {
    const phone = dto.phone.trim();
    const email = dto.email?.trim().toLowerCase() ?? null;

    if (await this.repo.phoneExists(phone)) {
      throw new ConflictException('Phone number is already registered');
    }
    if (email && (await this.repo.emailExists(email))) {
      throw new ConflictException('Email is already registered');
    }

    // A random password the recipient never learns — they set their own via the
    // invitation link, so the account is never usable with this placeholder.
    const passwordHash = await argonHash(randomBytes(32).toString('base64url'));
    const user = await this.repo.createUser({
      fullName: dto.fullName.trim(),
      phone,
      email,
      passwordHash,
      role: dto.role,
    });

    const { token, tokenHash, expiresAt } = this.tokens.mintResetToken(INVITE_TOKEN_TTL_MS);
    await this.repo.createResetToken({ userId: user.id, tokenHash, expiresAt });
    const invitationLink = `${this.webOrigin()}/reset-password?token=${token}`;

    this.logger.log(`Admin created ${user.role} account ${user.id}`);
    return { user: mapUserProfile(user), invitationLink };
  }

  // Verify credentials and start a session. Errors are deliberately generic.
  async login(dto: LoginDto): Promise<AuthResponse> {
    const identifier = dto.emailOrPhone.trim().toLowerCase();
    const user = await this.repo.findActiveByEmailOrPhone(identifier);

    // Always run a verify (decoy when no user) to keep timing constant.
    const ok = await argonVerify(user?.passwordHash ?? (await this.decoyHash), dto.password);
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

    const stored = await this.repo.findRefreshByHash(this.tokens.hashToken(refreshToken));
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
    const stored = await this.repo.findRefreshByHash(this.tokens.hashToken(refreshToken));
    if (stored && !stored.revokedAt) {
      await this.repo.revokeRefreshToken(stored.id);
    }
  }

  /**
   * Start a password reset. Always resolves to the same shape — whether or not
   * the account exists — so the endpoint can't be used to enumerate users. The
   * link is delivered out-of-band (SMS / log sender) and only its hash is kept.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ success: true }> {
    const identifier = dto.emailOrPhone.trim().toLowerCase();
    const user = await this.repo.findActiveByEmailOrPhone(identifier);
    if (!user) {
      this.logger.log('Password reset requested for an unknown identifier');
      return { success: true };
    }

    // Only the newest link works — retire anything still outstanding.
    await this.repo.invalidateResetTokensForUser(user.id);
    const { token, tokenHash, expiresAt } = this.tokens.mintResetToken(RESET_TOKEN_TTL_MS);
    await this.repo.createResetToken({ userId: user.id, tokenHash, expiresAt });

    const link = `${this.webOrigin()}/reset-password?token=${token}`;
    await this.notifications.dispatch(
      user.id,
      NotificationType.PASSWORD_RESET,
      'Reset your password',
      `Reset your Genuine Homes password: ${link} — the link expires in 30 minutes. If you didn't request this, ignore this message.`,
    );

    this.logger.log(`Password reset link issued for user ${user.id}`);
    return { success: true };
  }

  /** Complete a reset: burn the token, set the password, end every session. */
  async resetPassword(dto: ResetPasswordDto): Promise<{ success: true }> {
    const stored = await this.repo.findResetTokenByHash(this.tokens.hashToken(dto.token));
    // One generic error for every failure mode — the token is the only secret.
    if (!stored || stored.usedAt || stored.expiresAt <= new Date()) {
      throw new UnauthorizedException('This reset link is invalid or has expired');
    }
    const user = await this.repo.findActiveById(stored.userId);
    if (!user) {
      throw new UnauthorizedException('This reset link is invalid or has expired');
    }

    const passwordHash = await argonHash(dto.password);
    await this.repo.consumeResetToken(stored.id, user.id, passwordHash);

    this.logger.log(`Password reset completed for user ${user.id}`);
    return { success: true };
  }

  /**
   * Change the password for a logged-in user. Proves ownership by checking the
   * current password, refuses a no-op change, then sets the new hash and ends
   * every existing session — and issues a fresh one so this client stays signed
   * in while any other (possibly compromised) session is forced to re-auth.
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<AuthResponse> {
    const user = await this.repo.findActiveById(userId);
    if (!user) throw new UnauthorizedException('Account no longer exists');

    const ok = await argonVerify(user.passwordHash, dto.currentPassword);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');

    if (await argonVerify(user.passwordHash, dto.newPassword)) {
      throw new BadRequestException('New password must be different from the current one');
    }

    const passwordHash = await argonHash(dto.newPassword);
    await this.repo.updatePassword(user.id, passwordHash);

    this.logger.log(`Password changed for user ${user.id}`);
    return this.issueSession(user);
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
      tokenHash: this.tokens.hashToken(refresh.token),
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

  // The web app's origin for links in outbound messages. PUBLIC_WEB_URL when
  // set, otherwise the first allowed CORS origin (the web app in every env).
  private webOrigin(): string {
    const explicit = this.config.get('PUBLIC_WEB_URL', { infer: true });
    if (explicit) return explicit.replace(/\/$/, '');
    const firstCors = this.config.get('CORS_ORIGINS', { infer: true }).split(',')[0]?.trim();
    return (firstCors || 'http://localhost:5173').replace(/\/$/, '');
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
      identityVerifiedAt: user.identityVerifiedAt
        ? user.identityVerifiedAt.toISOString()
        : null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
