import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { RentalsController } from './rentals.controller';
import { RentalsRepository } from './rentals.repository';
import { RentalsService } from './rentals.service';

/**
 * Rentals. Imports PaymentsModule to start rent payments and reacts to
 * PAYMENT_SUCCEEDED (purpose=rent) to activate a pending agreement. The rent
 * ledger lives in the unified payments table (referenceId = agreement id).
 */
@Module({
  imports: [PaymentsModule],
  controllers: [RentalsController],
  providers: [RentalsService, RentalsRepository],
})
export class RentalsModule {}
