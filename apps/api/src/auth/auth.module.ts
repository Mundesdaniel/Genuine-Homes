import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TokenService } from './token.service';

/**
 * Auth module. Registers the credential endpoints plus two app-wide guards:
 * JwtAuthGuard (authenticate everything except @Public routes) and RolesGuard
 * (enforce @Roles). Secrets/TTLs are read per-token in TokenService, so
 * JwtModule needs no static config here.
 */
@Module({
  // NotificationsModule delivers password-reset links (log/SMS senders).
  imports: [JwtModule.register({}), NotificationsModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    TokenService,
    // Order matters: authenticate first, then authorize.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [TokenService],
})
export class AuthModule {}
