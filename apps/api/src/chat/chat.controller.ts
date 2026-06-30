import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  ConversationSummary,
  MessageResponse,
  Paginated,
} from '@genuine-homes/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ThreadQueryDto } from './dto/thread-query.dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post('messages')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a message (recipient is pushed it over WebSocket)' })
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendMessageDto,
  ): Promise<MessageResponse> {
    return this.chat.send(user, dto);
  }

  @Get('conversations')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List your conversations (latest message + unread)' })
  conversations(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConversationSummary[]> {
    return this.chat.conversations(user);
  }

  @Get('messages')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a thread with one user (marks it read)' })
  thread(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ThreadQueryDto,
  ): Promise<Paginated<MessageResponse>> {
    return this.chat.thread(user, query.withUserId, query.page, query.pageSize);
  }
}
