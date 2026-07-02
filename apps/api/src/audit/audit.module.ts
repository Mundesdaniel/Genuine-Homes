import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';

/**
 * Global so any module can inject `AuditService` without an explicit import —
 * audit writes happen from payments, users, verifications, installments, …
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditRepository],
  exports: [AuditService],
})
export class AuditModule {}
