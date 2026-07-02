import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type Paginated, UserRole } from '@genuine-homes/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService, type AuditLogResponse } from './audit.service';
import { ListAuditQueryDto } from './dto/list-audit-query.dto';

@ApiTags('admin')
@Controller('admin/audit-logs')
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Admin: browse the audit trail (newest first)' })
  list(@Query() query: ListAuditQueryDto): Promise<Paginated<AuditLogResponse>> {
    return this.audit.list(
      {
        action: query.action,
        entityType: query.entityType,
        entityId: query.entityId,
        actorId: query.actorId,
      },
      query.page,
      query.pageSize,
    );
  }
}
