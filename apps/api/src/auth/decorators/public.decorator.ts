import { SetMetadata } from '@nestjs/common';

// Marks a route as open — the global JwtAuthGuard skips authentication for it.
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
