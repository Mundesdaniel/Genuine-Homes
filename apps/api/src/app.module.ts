import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { InstallmentsModule } from './installments/installments.module';
import { ListingsModule } from './listings/listings.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { PropertiesModule } from './properties/properties.module';

/**
 * Root module of the Genuine Homes modular monolith.
 *
 * Feature modules (auth, users, properties, listings, installments, rentals,
 * payments, verifications, chat, notifications, admin) are registered here as
 * they are built, each following the Controller → Service → Repository layering.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      cache: true,
    }),
    // Default rate limit applied to every route (100 req/min/IP); auth
    // endpoints tighten this with @Throttle. ttl is in milliseconds.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    // Event-driven side effects (e.g. a settled payment activating a plan).
    EventEmitterModule.forRoot(),
    PrismaModule,
    AuthModule,
    PropertiesModule,
    ListingsModule,
    PaymentsModule,
    InstallmentsModule,
    HealthModule,
  ],
  providers: [
    // App-wide rate limiting; auth's JwtAuthGuard/RolesGuard are added in AuthModule.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
