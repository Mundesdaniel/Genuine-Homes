import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  InstallmentPlanDetail,
  Paginated,
  PaymentInitiation,
  PlanRequestResponse,
} from '@genuine-homes/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { DeclinePlanDto } from './dto/decline-plan.dto';
import { PayViaDto } from './dto/pay-via.dto';
import { InstallmentsService } from './installments.service';

@ApiTags('installments')
@Controller('installment-plans')
export class InstallmentsController {
  constructor(private readonly installments: InstallmentsService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an installment plan from a listing' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePlanDto,
  ): Promise<InstallmentPlanDetail> {
    return this.installments.createPlan(user, dto);
  }

  @Get('mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List your installment plans' })
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<InstallmentPlanDetail>> {
    return this.installments.listMine(user, query.page, query.pageSize);
  }

  @Get('requests')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Plans buyers have requested on your properties (landlord view)' })
  listRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<PlanRequestResponse>> {
    return this.installments.listPlanRequests(user, query.page, query.pageSize);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a plan with its schedule + progress' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InstallmentPlanDetail> {
    return this.installments.getDetail(user, id);
  }

  @Post(':id/deposit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pay the deposit (activates the plan once settled)' })
  payDeposit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayViaDto,
  ): Promise<PaymentInitiation> {
    return this.installments.payDeposit(user, id, dto);
  }

  @Post(':id/installments/:installmentId/pay')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pay a scheduled installment' })
  payInstallment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('installmentId', ParseUUIDPipe) installmentId: string,
    @Body() dto: PayViaDto,
  ): Promise<PaymentInitiation> {
    return this.installments.payInstallment(user, id, installmentId, dto);
  }

  @Post(':id/cancel')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a plan that is still awaiting its deposit' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InstallmentPlanDetail> {
    return this.installments.cancel(user, id);
  }

  @Post(':id/accept')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Landlord: accept a requested plan (makes it payable)' })
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InstallmentPlanDetail> {
    return this.installments.accept(user, id);
  }

  @Post(':id/decline')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Landlord: decline a requested plan' })
  decline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeclinePlanDto,
  ): Promise<InstallmentPlanDetail> {
    return this.installments.decline(user, id, dto.reason ?? null);
  }
}
