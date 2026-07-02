import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { UploadsModule } from '../uploads/uploads.module';
import { VerificationsController } from './verifications.controller';
import { VerificationsRepository } from './verifications.repository';
import { VerificationsService } from './verifications.service';

/**
 * Property verification workflow. Imports NotificationsModule to tell the owner
 * when their property is verified, and UploadsModule for the URL signer that
 * turns private document keys into expiring links. Exports the service so the
 * admin module can reuse the queue/review operations.
 */
@Module({
  imports: [NotificationsModule, UploadsModule],
  controllers: [VerificationsController],
  providers: [VerificationsService, VerificationsRepository],
  exports: [VerificationsService],
})
export class VerificationsModule {}
