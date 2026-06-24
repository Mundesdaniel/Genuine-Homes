import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TokenService } from '../token.service';
import type { AuthenticatedUser } from '../types/jwt-payload';

/**
 * Global guard: every route requires a valid access token unless marked
 * `@Public()`. On success it attaches the user to the request for downstream
 * handlers, the RolesGuard, and `@CurrentUser()`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip auth entirely for routes opted out with @Public().
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string>; user?: AuthenticatedUser }>();
    const token = this.extractBearer(request.headers['authorization']);
    if (!token) throw new UnauthorizedException('Missing access token');

    let payload;
    try {
      payload = await this.tokens.verifyAccess(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    // Reject a refresh token presented in the Authorization header.
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    request.user = { id: payload.sub, role: payload.role };
    return true;
  }

  // Pull the token out of an `Authorization: Bearer <token>` header.
  private extractBearer(header: string | undefined): string | null {
    if (!header) return null;
    const [scheme, value] = header.split(' ');
    return scheme === 'Bearer' && value ? value : null;
  }
}
