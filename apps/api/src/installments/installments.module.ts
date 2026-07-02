import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { AdminInstallmentsController } from './admin-installments.controller';
import { InstallmentsController } from './installments.controller';
import { InstallmentsRepository } from './installments.repository';
import { InstallmentsScheduler } from './installments.scheduler';
import { InstallmentsService } from './installments.service';

/**
 * Installment engine. Imports PaymentsModule to start deposit/installment
 * payments, and reacts to settled payments via the PAYMENT_SUCCEEDED event
 * (EventEmitterModule is registered globally in AppModule). The scheduler runs
 * the nightly overdue/due-soon sweep (ScheduleModule is registered in AppModule).
 */
@Module({
  imports: [PaymentsModule],
  controllers: [InstallmentsController, AdminInstallmentsController],
  providers: [InstallmentsService, InstallmentsRepository, InstallmentsScheduler],
})
export class InstallmentsModule {}
