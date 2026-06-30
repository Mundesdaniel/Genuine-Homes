import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CHAT_MESSAGE_EVENT,
  type ConversationSummary,
  type MessageResponse,
  NotificationType,
  type Paginated,
} from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { mapMessage } from '../common/mappers';
import { NotificationsService } from '../notifications/notifications.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatGateway } from './chat.gateway';
import { ChatRepository } from './chat.repository';

@Injectable()
export class ChatService {
  constructor(
    private readonly repo: ChatRepository,
    private readonly gateway: ChatGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async send(
    user: AuthenticatedUser,
    dto: SendMessageDto,
  ): Promise<MessageResponse> {
    if (dto.receiverId === user.id) {
      throw new BadRequestException('You cannot message yourself');
    }
    const receiver = await this.repo.userExists(dto.receiverId);
    if (!receiver) throw new NotFoundException('Recipient not found');

    const message = await this.repo.create(
      user.id,
      dto.receiverId,
      dto.listingId ?? null,
      dto.body,
    );
    const response = mapMessage(message);

    // Realtime push to the recipient, plus a durable notification.
    this.gateway.emitToUser(dto.receiverId, CHAT_MESSAGE_EVENT, response);
    await this.notifications.notify(
      dto.receiverId,
      NotificationType.NEW_MESSAGE,
      'New message',
      dto.body.length > 80 ? `${dto.body.slice(0, 80)}…` : dto.body,
      { senderId: user.id, messageId: message.id, listingId: dto.listingId ?? null },
    );

    return response;
  }

  // A thread with one partner; opening it marks their messages read.
  async thread(
    user: AuthenticatedUser,
    partnerId: string,
    page: number,
    pageSize: number,
  ): Promise<Paginated<MessageResponse>> {
    await this.repo.markThreadRead(user.id, partnerId);
    const [rows, total] = await this.repo.thread(
      user.id,
      partnerId,
      (page - 1) * pageSize,
      pageSize,
    );
    return { items: rows.map(mapMessage), total, page, pageSize };
  }

  // One row per conversation partner (latest message + unread count).
  async conversations(user: AuthenticatedUser): Promise<ConversationSummary[]> {
    const recent = await this.repo.recentInvolving(user.id, 200);
    const unread = await this.repo.unreadBySender(user.id);
    const byPartner = new Map<string, ConversationSummary>();

    for (const m of recent) {
      const partner = m.senderId === user.id ? m.receiver : m.sender;
      if (byPartner.has(partner.id)) continue; // recent is newest-first
      byPartner.set(partner.id, {
        partner: { id: partner.id, fullName: partner.fullName },
        lastMessage: m.body,
        lastAt: m.createdAt.toISOString(),
        unread: unread.get(partner.id) ?? 0,
      });
    }
    return [...byPartner.values()];
  }
}
