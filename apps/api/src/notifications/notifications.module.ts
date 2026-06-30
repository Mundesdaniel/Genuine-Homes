import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';
import { LogNotificationSender } from './senders/log-notification-sender';
import {
  NOTIFICATION_SENDERS,
  type NotificationSender,
} from './senders/notification-sender.interface';
import { SmsNotificationSender } from './senders/sms-notification-sender';

/**
 * Notifications module. Subscribes to domain events (payment settled, an
 * installment due/overdue) and writes in-app notifications, fanning each one
 * out to the registered delivery channels (Strategy). The log channel is always
 * on; SMS (Africa's Talking) is added when credentials are configured.
 *
 * Exports NotificationsService so other modules can notify directly. No DI
 * dependency on payments/installments — cross-module reactions arrive via the
 * global EventEmitter.
 */
@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    {
      provide: NOTIFICATION_SENDERS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const senders: NotificationSender[] = [new LogNotificationSender()];
        if (config.get('AFRICASTALKING_API_KEY', { infer: true })) {
          senders.push(new SmsNotificationSender(config));
        }
        return senders;
      },
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
