import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

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
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
