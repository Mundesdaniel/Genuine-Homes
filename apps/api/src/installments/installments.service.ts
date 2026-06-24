import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import {
  INSTALLMENT,
  type InstallmentPlanDetail,
  InstallmentPlanStatus,
  type Paginated,
  type PaymentInitiation,
  PaymentPurpose,
  UserRole,
} from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { mapPlanDetail } from '../common/mappers';
import {
  PAYMENT_SUCCEEDED,
  type PaymentSucceededEvent,
} from '../payments/payment-events';
import { PaymentsService } from '../payments/payments.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { PayViaDto } from './dto/pay-via.dto';
import { InstallmentsRepository } from './installments.repository';

// Add n calendar months to a date (UTC).
function addMonths(date: Date, n: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, date.getUTCDate()),
  );
}

@Injectable()
export class InstallmentsService {
  private readonly logger = new Logger(InstallmentsService.name);

  constructor(
    private readonly repo: InstallmentsRepository,
    private readonly payments: PaymentsService,
  ) {}

  // Turn an installment listing into a plan: compute the deposit + an exact
  // monthly schedule (the last installment absorbs any rounding remainder).
  async createPlan(
    user: AuthenticatedUser,
    dto: CreatePlanDto,
  ): Promise<InstallmentPlanDetail> {
    const listing = await this.repo.findActiveInstallmentListing(dto.listingId);
    if (!listing) throw new NotFoundException('Installment listing not found');

    const minDeposit = listing.minDepositPercent
      ? listing.minDepositPercent.toNumber()
      : INSTALLMENT.MIN_DEPOSIT_PERCENT;
    if (dto.depositPercent < minDeposit) {
      throw new BadRequestException(`Deposit must be at least ${minDeposit}%`);
    }
    const maxMonths = listing.maxInstallmentMonths ?? INSTALLMENT.MAX_MONTHS;
    if (dto.months > maxMonths) {
      throw new BadRequestException(`This listing allows up to ${maxMonths} months`);
    }

    const total = listing.price;
    const deposit = total.mul(dto.depositPercent).div(100).toDecimalPlaces(2);
    const financed = total.minus(deposit);
    const baseMonthly = financed
      .div(dto.months)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);

    const start = new Date();
    const schedule = [];
    let allocated = new Prisma.Decimal(0);
    for (let i = 1; i <= dto.months; i++) {
      const amount = i < dto.months ? baseMonthly : financed.minus(allocated);
      allocated = allocated.plus(amount);
      schedule.push({ sequence: i, amount, dueDate: addMonths(start, i) });
    }

    const planId = await this.repo.createPlanWithSchedule(
      {
        listingId: listing.id,
        buyerId: user.id,
        totalPrice: total,
        depositAmount: deposit,
        months: dto.months,
        monthlyAmount: baseMonthly,
        currency: listing.currency,
      },
      schedule,
    );
    this.logger.log(`Plan ${planId} created (pending deposit)`);
    return this.getDetail(user, planId);
  }

  async getDetail(
    user: AuthenticatedUser,
    planId: string,
  ): Promise<InstallmentPlanDetail> {
    const plan = await this.repo.findPlanDetail(planId);
    if (!plan) throw new NotFoundException('Plan not found');
    this.assertBuyer(plan.buyerId, user);
    return mapPlanDetail(plan);
  }

  async listMine(
    user: AuthenticatedUser,
    page: number,
    pageSize: number,
  ): Promise<Paginated<InstallmentPlanDetail>> {
    const [rows, total] = await this.repo.findPlansByBuyer(
      user.id,
      (page - 1) * pageSize,
      pageSize,
    );
    return { items: rows.map(mapPlanDetail), total, page, pageSize };
  }

  // Start the deposit payment; the plan activates when it settles (via event).
  async payDeposit(
    user: AuthenticatedUser,
    planId: string,
    dto: PayViaDto,
  ): Promise<PaymentInitiation> {
    const plan = await this.repo.findPlanById(planId);
    if (!plan) throw new NotFoundException('Plan not found');
    this.assertBuyer(plan.buyerId, user);
    if (plan.status !== InstallmentPlanStatus.PENDING_DEPOSIT) {
      throw new BadRequestException('Deposit is not payable for this plan');
    }
    return this.payments.initiate(user, {
      purpose: PaymentPurpose.DEPOSIT,
      referenceId: plan.id,
      amount: plan.depositAmount.toNumber(),
      currency: plan.currency,
      provider: dto.provider,
      phone: dto.phone,
    });
  }

  async payInstallment(
    user: AuthenticatedUser,
    planId: string,
    installmentId: string,
    dto: PayViaDto,
  ): Promise<PaymentInitiation> {
    const plan = await this.repo.findPlanById(planId);
    if (!plan) throw new NotFoundException('Plan not found');
    this.assertBuyer(plan.buyerId, user);
    if (plan.status !== InstallmentPlanStatus.ACTIVE) {
      throw new BadRequestException('Plan is not active');
    }
    const item = await this.repo.findInstallmentPayment(installmentId);
    if (!item || item.planId !== planId) {
      throw new NotFoundException('Installment not found');
    }
    if (item.status === 'paid') {
      throw new BadRequestException('Installment already paid');
    }
    return this.payments.initiate(user, {
      purpose: PaymentPurpose.INSTALLMENT,
      referenceId: item.id,
      amount: item.amount.toNumber(),
      currency: plan.currency,
      provider: dto.provider,
      phone: dto.phone,
    });
  }

  async cancel(
    user: AuthenticatedUser,
    planId: string,
  ): Promise<InstallmentPlanDetail> {
    const plan = await this.repo.findPlanById(planId);
    if (!plan) throw new NotFoundException('Plan not found');
    this.assertBuyer(plan.buyerId, user);
    if (plan.status !== InstallmentPlanStatus.PENDING_DEPOSIT) {
      throw new BadRequestException('Only a plan awaiting deposit can be cancelled');
    }
    await this.repo.updatePlanStatus(plan.id, InstallmentPlanStatus.CANCELLED, null);
    return this.getDetail(user, plan.id);
  }

  /**
   * React to a settled payment: a deposit activates the plan; an installment
   * marks its schedule item paid and completes the plan when nothing is left.
   */
  @OnEvent(PAYMENT_SUCCEEDED)
  async onPaymentSucceeded(event: PaymentSucceededEvent): Promise<void> {
    try {
      if (event.purpose === PaymentPurpose.DEPOSIT && event.referenceId) {
        const plan = await this.repo.findPlanById(event.referenceId);
        if (plan && plan.status === InstallmentPlanStatus.PENDING_DEPOSIT) {
          const { nextDue } = await this.repo.scheduleProgress(plan.id);
          await this.repo.updatePlanStatus(plan.id, InstallmentPlanStatus.ACTIVE, nextDue);
          this.logger.log(`Plan ${plan.id} activated by deposit`);
        }
      } else if (event.purpose === PaymentPurpose.INSTALLMENT && event.referenceId) {
        const item = await this.repo.findInstallmentPayment(event.referenceId);
        if (item && item.status !== 'paid') {
          await this.repo.markInstallmentPaid(item.id, event.paymentId);
          const { nextDue, allPaid } = await this.repo.scheduleProgress(item.planId);
          if (allPaid) {
            await this.repo.updatePlanStatus(item.planId, InstallmentPlanStatus.COMPLETED, null);
            this.logger.log(`Plan ${item.planId} completed`);
          } else {
            await this.repo.setNextDueDate(item.planId, nextDue);
          }
        }
      }
    } catch (err) {
      this.logger.error(
        `Failed handling ${PAYMENT_SUCCEEDED} for payment ${event.paymentId}: ${String(err)}`,
      );
    }
  }

  private assertBuyer(buyerId: string, user: AuthenticatedUser): void {
    if (user.role !== UserRole.ADMIN && buyerId !== user.id) {
      throw new ForbiddenException('This plan is not yours');
    }
  }
}
