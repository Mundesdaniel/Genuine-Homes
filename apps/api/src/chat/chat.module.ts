import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatRepository } from './chat.repository';
import { ChatService } from './chat.service';

/**
 * Chat. Clients send over REST and receive over the WebSocket gateway. Imports
 * AuthModule for TokenService (handshake auth) and NotificationsModule to raise
 * a `new_message` notification for the recipient.
 */
@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [ChatController],
  providers: [ChatService, ChatRepository, ChatGateway],
})
export class ChatModule {}
