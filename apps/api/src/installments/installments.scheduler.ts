import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InstallmentsService } from './installments.service';

/**
 * Drives the nightly installment sweep. Kept separate from the service so the
 * sweep logic stays a plain, unit-testable method while the cron registration
 * lives in one obvious place. Requires `ScheduleModule.forRoot()` (registered
 * in AppModule); in unit tests the service method is called directly, so this
 * provider never fires.
 */
@Injectable()
export class InstallmentsScheduler {
  private readonly logger = new Logger(InstallmentsScheduler.name);

  constructor(private readonly installments: InstallmentsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM, { name: 'installment-overdue-sweep' })
  async nightlySweep(): Promise<void> {
    try {
      await this.installments.sweepOverdue();
    } catch (err) {
      this.logger.error(`Nightly installment sweep failed: ${String(err)}`);
    }
  }
}
