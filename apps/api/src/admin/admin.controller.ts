import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  UserRole,
  type AdminAgentPerformanceRow,
  type AdminDealRow,
  type AdminOverviewResponse,
  type AdminPropertyRow,
  type Paginated,
} from '@genuine-homes/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AdminService } from './admin.service';

@ApiTags('admin')
@Controller('admin')
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Platform headline counts + settled revenue' })
  overview(): Promise<AdminOverviewResponse> {
    return this.admin.overview();
  }

  @Get('properties')
  @ApiOperation({ summary: 'All properties with the agent who added each' })
  properties(@Query() query: PaginationQueryDto): Promise<Paginated<AdminPropertyRow>> {
    return this.admin.properties(query.page, query.pageSize);
  }

  @Get('deals')
  @ApiOperation({
    summary: 'Successful deals (rental/installment/purchase) with agent + client',
  })
  deals(@Query() query: PaginationQueryDto): Promise<Paginated<AdminDealRow>> {
    return this.admin.deals(query.page, query.pageSize);
  }

  @Get('agents')
  @ApiOperation({ summary: 'Per-agent rollup: properties added + successful deals' })
  agents(): Promise<AdminAgentPerformanceRow[]> {
    return this.admin.agents();
  }
}
