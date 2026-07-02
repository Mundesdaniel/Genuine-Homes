import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env, resolvePaymentGateway } from '../config/env.validation';
import { FlutterwaveGateway } from './gateway/flutterwave.gateway';
import { MockGateway } from './gateway/mock.gateway';
import { PAYMENT_GATEWAY } from './gateway/payment-gateway.interface';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';

/**
 * Payments module. The active gateway (Strategy) is chosen at startup via
 * `PAYMENT_GATEWAY` (or inferred: Flutterwave when a secret key is configured,
 * otherwise the dev mock). Env validation refuses to boot a production build
 * on the mock unless `PAYMENT_GATEWAY=mock` was set explicitly.
 */
@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsRepository,
    {
      provide: PAYMENT_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const choice = resolvePaymentGateway({
          PAYMENT_GATEWAY: config.get('PAYMENT_GATEWAY', { infer: true }),
          FLUTTERWAVE_SECRET_KEY: config.get('FLUTTERWAVE_SECRET_KEY', { infer: true }),
        });
        if (choice === 'flutterwave') return new FlutterwaveGateway(config);
        new Logger('PaymentsModule').warn(
          'Payment gateway: MOCK — checkouts are simulated and webhooks are unauthenticated. Never use with real money.',
        );
        return new MockGateway();
      },
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
