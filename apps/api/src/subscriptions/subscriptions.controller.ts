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
import { UserRole, type Paginated, type SubscriptionResponse } from '@genuine-homes/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { RecordSubscriptionPaymentDto } from './dto/record-subscription-payment.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Your current subscription (or null)' })
  mine(@CurrentUser() user: AuthenticatedUser): Promise<SubscriptionResponse | null> {
    return this.subscriptions.getMine(user);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: list all subscriptions' })
  list(@Query() query: PaginationQueryDto): Promise<Paginated<SubscriptionResponse>> {
    return this.subscriptions.list(query.page, query.pageSize);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: record a cash subscription payment and activate it' })
  record(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: RecordSubscriptionPaymentDto,
  ): Promise<SubscriptionResponse> {
    return this.subscriptions.recordPayment(actor, dto);
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: cancel a subscription' })
  cancel(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SubscriptionResponse> {
    return this.subscriptions.cancel(actor, id);
  }
}
