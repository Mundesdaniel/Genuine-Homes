import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type CashPaymentToConfirm,
  DEFAULT_CURRENCY,
  type EarningsResponse,
  type Paginated,
  type PaymentInitiation,
  PaymentProvider,
  type PaymentResponse,
  PaymentStatus,
  UserRole,
} from '@genuine-homes/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { mapPayment } from '../common/mappers';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PAYMENT_SUCCEEDED, type PaymentSucceededEvent } from './payment-events';
import { PaymentsRepository } from './payments.repository';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly repo: PaymentsRepository,
    private readonly events: EventEmitter2,
    private readonly audit: AuditService,
  ) {}

  // Cash-only: online gateways are disabled, so every payment is paid in person.
  // We create a pending ledger row and leave it awaiting the property owner's
  // confirmation (confirmCash) — there is no gateway to call. The provider is
  // guaranteed to be `cash` by InitiatePaymentDto validation.
  async initiate(
    user: AuthenticatedUser,
    dto: InitiatePaymentDto,
  ): Promise<PaymentInitiation> {
    const customer = await this.repo.findUser(user.id);
    if (!customer) throw new NotFoundException('Account not found');

    const currency = dto.currency ?? DEFAULT_CURRENCY;
    const payment = await this.repo.create({
      userId: user.id,
      purpose: dto.purpose,
      referenceId: dto.referenceId ?? null,
      amount: dto.amount,
      currency,
      provider: PaymentProvider.CASH,
    });

    await this.audit.record({
      actorId: user.id,
      action: 'payment.cash_pending',
      entityType: 'payment',
      entityId: payment.id,
      metadata: { purpose: dto.purpose, amount: dto.amount, currency },
    });
    // No redirect — cash has no hosted checkout. The payer settles with the
    // owner in person, who then confirms receipt.
    return { payment: mapPayment(payment), redirectUrl: null };
  }

  async listMine(
    user: AuthenticatedUser,
    page: number,
    pageSize: number,
  ): Promise<Paginated<PaymentResponse>> {
    const [rows, total] = await this.repo.listByUser(user.id, (page - 1) * pageSize, pageSize);
    return { items: rows.map(mapPayment), total, page, pageSize };
  }

  /** Income this owner has received across their listings, for the dashboard. */
  async earnings(user: AuthenticatedUser): Promise<EarningsResponse> {
    const byMonth = await this.repo.earningsByOwner(user.id);
    const totalReceived = byMonth.reduce((sum, r) => sum + r.amount, 0);
    return { totalReceived, currency: DEFAULT_CURRENCY, byMonth };
  }

  async getOne(user: AuthenticatedUser, id: string): Promise<PaymentResponse> {
    const payment = await this.repo.findById(id);
    if (!payment) throw new NotFoundException('Payment not found');
    if (user.role !== UserRole.ADMIN && payment.userId !== user.id) {
      throw new ForbiddenException('This payment is not yours');
    }
    return mapPayment(payment);
  }

  /** Pending cash payments awaiting the current owner's confirmation. */
  listIncomingCash(user: AuthenticatedUser): Promise<CashPaymentToConfirm[]> {
    return this.repo.findIncomingCash(user.id);
  }

  /**
   * The property owner (or an admin) confirms a pending cash payment was
   * received in person. Settles it successful and fires the same success event
   * as an online settlement — so the property is marked sold/rented, a plan is
   * activated, etc., exactly as it would be for a gateway payment.
   */
  async confirmCash(user: AuthenticatedUser, id: string): Promise<PaymentResponse> {
    const payment = await this.repo.findById(id);
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.provider !== PaymentProvider.CASH) {
      throw new BadRequestException('This payment is not a cash payment');
    }
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('This payment has already been settled');
    }
    if (user.role !== UserRole.ADMIN) {
      const ownerId = await this.repo.findPaymentOwner(id);
      if (!ownerId || ownerId !== user.id) {
        throw new ForbiddenException('This payment is not for your property');
      }
    }

    const changed = await this.repo.settle(id, `cash_${id}`, PaymentStatus.SUCCESSFUL);
    if (changed) {
      await this.audit.record({
        actorId: user.id,
        action: 'payment.cash_confirmed',
        entityType: 'payment',
        entityId: id,
        metadata: { amount: payment.amount.toNumber(), currency: payment.currency },
      });
      await this.announceSuccess(id);
      this.logger.log(`Cash payment ${id} confirmed received by ${user.id}`);
    }
    const fresh = (await this.repo.findById(id)) ?? payment;
    return mapPayment(fresh);
  }

  /**
   * Broadcast a settled payment so subscribers (installments, rentals) can
   * react — e.g. activate a plan or mark a schedule item paid.
   */
  private async announceSuccess(paymentId: string): Promise<void> {
    const payment = await this.repo.findById(paymentId);
    if (!payment) return;
    const event: PaymentSucceededEvent = {
      paymentId: payment.id,
      userId: payment.userId,
      purpose: payment.purpose,
      referenceId: payment.referenceId ?? null,
      amount: payment.amount.toNumber(),
    };
    this.events.emit(PAYMENT_SUCCEEDED, event);
  }
}
