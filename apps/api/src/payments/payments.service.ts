import {
  BadGatewayException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DEFAULT_CURRENCY,
  type Paginated,
  type PaymentInitiation,
  type PaymentResponse,
  PaymentStatus,
  UserRole,
} from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { mapPayment } from '../common/mappers';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import {
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from './gateway/payment-gateway.interface';
import {
  PAYMENT_SUCCEEDED,
  type PaymentSucceededEvent,
} from './payment-events';
import { PaymentsRepository } from './payments.repository';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly repo: PaymentsRepository,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly events: EventEmitter2,
  ) {}

  // Create a pending ledger row, then ask the gateway to start the charge.
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
      provider: dto.provider,
    });

    let result;
    try {
      result = await this.gateway.initiate({
        paymentId: payment.id,
        amount: dto.amount,
        currency,
        method: dto.provider,
        customer: {
          name: customer.fullName,
          email: customer.email,
          phone: dto.phone ?? customer.phone,
        },
        purpose: dto.purpose,
        redirectUrl: dto.redirectUrl,
      });
    } catch {
      await this.repo.markFailed(payment.id);
      this.logger.error(`Payment ${payment.id} initiation failed at the gateway`);
      throw new BadGatewayException('Could not start the payment. Please try again.');
    }

    if (result.providerRef) {
      await this.repo.setProviderRef(payment.id, result.providerRef);
    }
    const fresh = (await this.repo.findById(payment.id)) ?? payment;
    return { payment: mapPayment(fresh), redirectUrl: result.redirectUrl };
  }

  // Gateway callback. Verified, normalised, and applied idempotently.
  async handleWebhook(
    headers: Record<string, unknown>,
    body: unknown,
  ): Promise<{ received: true }> {
    if (!this.gateway.verifySignature(headers)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    const event = this.gateway.parseWebhook(body);
    if (!event) {
      this.logger.warn('Unrecognised webhook payload ignored');
      return { received: true };
    }

    const changed = await this.repo.settle(
      event.txRef,
      event.providerRef,
      event.status,
    );
    if (changed) {
      this.logger.log(`Payment ${event.txRef} settled as ${event.status}`);
      if (event.status === PaymentStatus.SUCCESSFUL) {
        await this.announceSuccess(event.txRef);
      }
    } else {
      this.logger.log(`Webhook for ${event.txRef} ignored (already settled)`);
    }
    return { received: true };
  }

  async listMine(
    user: AuthenticatedUser,
    page: number,
    pageSize: number,
  ): Promise<Paginated<PaymentResponse>> {
    const [rows, total] = await this.repo.listByUser(
      user.id,
      (page - 1) * pageSize,
      pageSize,
    );
    return { items: rows.map(mapPayment), total, page, pageSize };
  }

  async getOne(
    user: AuthenticatedUser,
    id: string,
  ): Promise<PaymentResponse> {
    const payment = await this.repo.findById(id);
    if (!payment) throw new NotFoundException('Payment not found');
    if (user.role !== UserRole.ADMIN && payment.userId !== user.id) {
      throw new ForbiddenException('This payment is not yours');
    }
    return mapPayment(payment);
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
