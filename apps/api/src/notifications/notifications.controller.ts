import {
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
  NotificationResponse,
  Paginated,
  UnreadCountResponse,
} from '@genuine-homes/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List your notifications (newest first)' })
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<NotificationResponse>> {
    return this.notifications.listMine(user, query.page, query.pageSize);
  }

  @Get('unread-count')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Number of unread notifications (header badge)' })
  unreadCount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UnreadCountResponse> {
    return this.notifications.unreadCount(user);
  }

  @Post('read-all')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark all your notifications read' })
  markAllRead(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UnreadCountResponse> {
    return this.notifications.markAllRead(user);
  }

  @Post(':id/read')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark one notification read' })
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UnreadCountResponse> {
    return this.notifications.markRead(user, id);
  }
}
