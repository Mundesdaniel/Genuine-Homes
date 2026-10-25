import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  CashPaymentToConfirm,
  EarningsResponse,
  Paginated,
  PaymentInitiation,
  PaymentResponse,
} from '@genuine-homes/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('initiate')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start a payment and get a checkout URL' })
  initiate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InitiatePaymentDto,
  ): Promise<PaymentInitiation> {
    return this.payments.initiate(user, dto);
  }

  @Get('mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List your payments' })
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<PaymentResponse>> {
    return this.payments.listMine(user, query.page, query.pageSize);
  }

  @Get('earnings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Income received on your listings (seller dashboard)' })
  earnings(@CurrentUser() user: AuthenticatedUser): Promise<EarningsResponse> {
    return this.payments.earnings(user);
  }

  // Cash-only: the gateway webhook route (`POST /payments/webhook`) has been
  // removed. Payments settle via the owner confirming cash receipt below
  // (`POST /payments/:id/confirm-cash`). To re-enable online payments, restore
  // the @Public() webhook handler that delegated to PaymentsService.handleWebhook.

  @Get('incoming-cash')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pending cash payments awaiting your confirmation (owner)' })
  incomingCash(@CurrentUser() user: AuthenticatedUser): Promise<CashPaymentToConfirm[]> {
    return this.payments.listIncomingCash(user);
  }

  @Post(':id/confirm-cash')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Owner: confirm a cash payment was received' })
  confirmCash(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PaymentResponse> {
    return this.payments.confirmCash(user, id);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get one of your payments' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PaymentResponse> {
    return this.payments.getOne(user, id);
  }
}
