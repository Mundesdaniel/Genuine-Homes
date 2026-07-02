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
import {
  type InstallmentPlanDetail,
  type Paginated,
  UserRole,
} from '@genuine-homes/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { DefaultPlanDto } from './dto/default-plan.dto';
import { ReinstatePlanDto } from './dto/reinstate-plan.dto';
import {
  type DefaultEligiblePlanResponse,
  InstallmentsService,
} from './installments.service';

/**
 * Admin-only plan lifecycle decisions. Defaulting is a contractual/legal call,
 * so it is never automated — the sweep only *flags* plans (missed-installment
 * threshold); a human confirms here, with a reason, and it lands in the audit
 * trail.
 */
@ApiTags('admin')
@Controller('admin/installment-plans')
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminInstallmentsController {
  constructor(private readonly installments: InstallmentsService) {}

  @Get('default-eligible')
  @ApiOperation({
    summary:
      'Admin: active plans past the missed-installment threshold (default review queue)',
  })
  listDefaultEligible(
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<DefaultEligiblePlanResponse>> {
    return this.installments.listDefaultEligible(query.page, query.pageSize);
  }

  @Post(':id/default')
  @ApiOperation({ summary: 'Admin: mark an active plan defaulted (audited, reason required)' })
  markDefaulted(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DefaultPlanDto,
  ): Promise<InstallmentPlanDetail> {
    return this.installments.markDefaulted(actor, id, dto.reason);
  }

  @Post(':id/reinstate')
  @ApiOperation({ summary: 'Admin: reinstate a defaulted plan back to active' })
  reinstate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReinstatePlanDto,
  ): Promise<InstallmentPlanDetail> {
    return this.installments.reinstate(actor, id, dto.reason ?? null);
  }
}
