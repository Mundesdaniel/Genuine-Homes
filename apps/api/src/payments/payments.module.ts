import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { FlutterwaveGateway } from './gateway/flutterwave.gateway';
import { MockGateway } from './gateway/mock.gateway';
import { PAYMENT_GATEWAY } from './gateway/payment-gateway.interface';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';

/**
 * Payments module. The active gateway (Strategy) is chosen at startup:
 * Flutterwave when a secret key is configured, otherwise a no-op mock so the
 * flow works end-to-end in development without real credentials.
 */
@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsRepository,
    {
      provide: PAYMENT_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get('FLUTTERWAVE_SECRET_KEY', { infer: true })
          ? new FlutterwaveGateway(config)
          : new MockGateway(),
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
