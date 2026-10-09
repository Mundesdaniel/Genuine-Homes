import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  EarningsResponse,
  Paginated,
  PaymentInitiation,
  PaymentResponse,
} from '@genuine-homes/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
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

  // Public: authenticated by the gateway's signature, not a JWT.
  @Public()
  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Payment gateway webhook (idempotent)' })
  webhook(
    @Headers() headers: Record<string, string>,
    @Body() body: Record<string, unknown>,
  ): Promise<{ received: true }> {
    return this.payments.handleWebhook(headers, body);
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
