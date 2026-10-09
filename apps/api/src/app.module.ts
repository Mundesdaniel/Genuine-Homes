import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { ChatModule } from './chat/chat.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { type Env, validateEnv } from './config/env.validation';
import { FavoritesModule } from './favorites/favorites.module';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { InstallmentsModule } from './installments/installments.module';
import { ListingsModule } from './listings/listings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { PropertiesModule } from './properties/properties.module';
import { PurchasesModule } from './purchases/purchases.module';
import { RentalsModule } from './rentals/rentals.module';
import { ReviewsModule } from './reviews/reviews.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';
import { VerificationsModule } from './verifications/verifications.module';

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
    // Structured request logging (pino). Every line carries the request id set
    // by requestContextMiddleware, so a payment can be traced end to end.
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const isProd = config.get('NODE_ENV', { infer: true }) === 'production';
        return {
          pinoHttp: {
            level:
              config.get('LOG_LEVEL', { infer: true }) ??
              (isProd ? 'info' : 'debug'),
            // Reuse the correlation id minted by requestContextMiddleware.
            genReqId: (req) =>
              (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
            redact: {
              paths: ['req.headers.authorization', 'req.headers.cookie'],
              remove: true,
            },
            autoLogging: {
              // Health checks poll frequently — keep them out of the logs.
              ignore: (req) => req.url === '/api/health',
            },
            transport: isProd
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' },
                },
          },
        };
      },
    }),
    // Default rate limit applied to every route (100 req/min/IP); auth
    // endpoints tighten this with @Throttle. ttl is in milliseconds.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    // Event-driven side effects (e.g. a settled payment activating a plan).
    EventEmitterModule.forRoot(),
    // Cron scheduling (nightly installment overdue/due-soon sweep).
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    AuthModule,
    PropertiesModule,
    ListingsModule,
    PaymentsModule,
    InstallmentsModule,
    NotificationsModule,
    FavoritesModule,
    ReviewsModule,
    RentalsModule,
    PurchasesModule,
    VerificationsModule,
    IdentityModule,
    UsersModule,
    AdminModule,
    ChatModule,
    BookingsModule,
    UploadsModule,
    HealthModule,
  ],
  providers: [
    // App-wide rate limiting; auth's JwtAuthGuard/RolesGuard are added in AuthModule.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Uniform error responses + correlation ids; 500s never leak internals.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
