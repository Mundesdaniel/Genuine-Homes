import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import type { AuthResponse, AuthUser } from '@genuine-homes/shared';
import type { Env } from '../config/env.validation';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { TokenService } from './token.service';

// Tight limit on credential endpoints to blunt brute-force / spam.
const CREDENTIAL_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

/** httpOnly cookie carrying the browser's refresh token. */
const REFRESH_COOKIE = 'gh_refresh';

/**
 * Every session-issuing response also sets the refresh token as an httpOnly
 * cookie, so the web app never has to persist it where scripts can read it.
 * The token stays in the JSON body too — non-browser clients (the future
 * mobile app, scripts) manage tokens themselves and can't use cookies.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle(CREDENTIAL_THROTTLE)
  @Post('register')
  @ApiOperation({ summary: 'Create an account and start a session' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.withRefreshCookie(res, await this.auth.register(dto));
  }

  @Public()
  @Throttle(CREDENTIAL_THROTTLE)
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log in with email/phone + password' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.withRefreshCookie(res, await this.auth.login(dto));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Exchange a refresh token (gh_refresh cookie or body) for a new pair',
  })
  async refresh(
    @Req() req: Request,
    @Body() dto: RefreshDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const token = this.refreshTokenFrom(req, dto);
    if (!token) throw new UnauthorizedException('No refresh token provided');
    return this.withRefreshCookie(res, await this.auth.refresh(token));
  }

  // Requires a valid access token (global guard); revokes the given session.
  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the session (cookie or body token) and log out' })
  async logout(
    @Req() req: Request,
    @Body() dto: RefreshDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    // Clear the cookie unconditionally — logout must leave the browser clean
    // even when the token turns out stale or missing.
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
    const token = this.refreshTokenFrom(req, dto);
    if (token) await this.auth.logout(token);
    return { success: true };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiOkResponse({ description: 'The authenticated user profile.' })
  me(@CurrentUser('id') userId: string): Promise<AuthUser> {
    return this.auth.me(userId);
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  // Cookie first: a browser session must win over any (possibly stale) body
  // value a client library replays.
  private refreshTokenFrom(req: Request, dto: RefreshDto): string | undefined {
    const cookie = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    return cookie ?? dto.refreshToken;
  }

  private withRefreshCookie(res: Response, session: AuthResponse): AuthResponse {
    res.cookie(REFRESH_COOKIE, session.refreshToken, {
      ...this.cookieOptions(),
      expires: this.tokens.refreshExpiry(session.refreshToken),
    });
    return session;
  }

  // httpOnly: unreadable to page scripts — the XSS win this exists for.
  // path /api/auth: the cookie only rides on auth calls, never ordinary API
  // traffic. sameSite lax: cross-site POSTs never carry it, closing CSRF on
  // /refresh. secure in production (HTTPS-only).
  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      path: '/api/auth',
    };
  }
}
