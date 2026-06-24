import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import { TokenService } from './auth/token.service';
import { PrismaService } from './prisma/prisma.service';

/**
 * Boots the full module graph with Prisma stubbed out (no database needed).
 * This proves the wiring is sound: the global JwtAuthGuard/RolesGuard,
 * ThrottlerModule, JwtModule, and AuthModule all resolve their dependencies.
 */
describe('AppModule wiring', () => {
  // Provide the config the env validator requires, so we don't depend on .env.
  beforeAll(() => {
    process.env.DATABASE_URL =
      'postgresql://u:p@localhost:5432/db?schema=public';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
    process.env.JWT_REFRESH_SECRET = 'r'.repeat(40);
  });

  it('compiles with all guards and auth providers resolvable', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({}) // never touched — DI only needs the token to exist.
      .compile();

    expect(moduleRef.get(AuthService)).toBeInstanceOf(AuthService);
    expect(moduleRef.get(TokenService)).toBeInstanceOf(TokenService);

    await moduleRef.close();
  });
});
