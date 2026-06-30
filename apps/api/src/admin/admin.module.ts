import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminRepository } from './admin.repository';
import { AdminService } from './admin.service';

/**
 * Admin analytics. Moderation (verification queue/review) and user management
 * live in their own modules with admin RBAC; this module adds the platform
 * overview the dashboard needs.
 */
@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminRepository],
})
export class AdminModule {}
