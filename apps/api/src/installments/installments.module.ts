import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { InstallmentsController } from './installments.controller';
import { InstallmentsRepository } from './installments.repository';
import { InstallmentsService } from './installments.service';

/**
 * Installment engine. Imports PaymentsModule to start deposit/installment
 * payments, and reacts to settled payments via the PAYMENT_SUCCEEDED event
 * (EventEmitterModule is registered globally in AppModule).
 */
@Module({
  imports: [PaymentsModule],
  controllers: [InstallmentsController],
  providers: [InstallmentsService, InstallmentsRepository],
})
export class InstallmentsModule {}
