import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { PaymentsModule } from '../payments/payments.module';
import { PurchasesController } from './purchases.controller';
import { PurchasesRepository } from './purchases.repository';
import { PurchasesService } from './purchases.service';

/**
 * Outright purchase flow. Imports PaymentsModule to start the full-price
 * payment, and reacts to PAYMENT_SUCCEEDED to mark the property sold
 * (EventEmitterModule is registered globally in AppModule).
 */
@Module({
  imports: [PaymentsModule, BookingsModule],
  controllers: [PurchasesController],
  providers: [PurchasesService, PurchasesRepository],
})
export class PurchasesModule {}
