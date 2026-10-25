import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';

/**
 * Payments module — CASH ONLY.
 *
 * Online payment gateways are disabled: every payment is paid in person and
 * confirmed by the property owner (see PaymentsService.confirmCash). As a
 * result this module no longer wires a PAYMENT_GATEWAY provider, and the
 * `/payments/webhook` route has been removed from PaymentsController.
 *
 * The gateway files remain in `./gateway` (FlutterwaveGateway, MockGateway,
 * the PaymentGateway interface) and are intact but unused. To re-enable online
 * payments, restore the `PAYMENT_GATEWAY` provider below (the Strategy factory
 * that picked Flutterwave vs. the dev mock via `resolvePaymentGateway`), widen
 * InitiatePaymentDto's `provider` back to all providers, and restore the
 * gateway branch in PaymentsService.initiate + the handleWebhook handler.
 */
@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsRepository],
  exports: [PaymentsService],
})
export class PaymentsModule {}
