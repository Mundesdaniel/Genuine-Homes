import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { UploadsModule } from '../uploads/uploads.module';
import { IdentityController } from './identity.controller';
import { IdentityRepository } from './identity.repository';
import { IdentityService } from './identity.service';
import { NinHasherService } from './nin-hasher.service';

/**
 * Identity (KYC) verification: sellers submit their National ID, admins review,
 * approval stamps `user.identityVerifiedAt`. Exports the service so the
 * properties module can enforce the publication gate (no unverified seller can
 * set a property `active`).
 */
@Module({
  imports: [NotificationsModule, UploadsModule],
  controllers: [IdentityController],
  providers: [IdentityService, IdentityRepository, NinHasherService],
  exports: [IdentityService],
})
export class IdentityModule {}
