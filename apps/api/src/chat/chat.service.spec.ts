import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CHAT_MESSAGE_EVENT, NotificationType, UserRole } from '@genuine-homes/shared';
import type { Message } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import type { NotificationsService } from '../notifications/notifications.service';
import type { ChatGateway } from './chat.gateway';
import type { ChatRepository, MessageWithNames } from './chat.repository';
import { ChatService } from './chat.service';

const me: AuthenticatedUser = { id: 'me', role: UserRole.USER };

const message = (over: Partial<Message> = {}): Message =>
  ({
    id: 'm-1',
    senderId: 'me',
    receiverId: 'other',
    listingId: null,
    body: 'Hello there',
    readAt: null,
    createdAt: new Date('2026-06-01T10:00:00Z'),
    ...over,
  }) as unknown as Message;

const withNames = (over: Partial<MessageWithNames> = {}): MessageWithNames =>
  ({
    ...message(),
    sender: { id: 'me', fullName: 'Me' },
    receiver: { id: 'other', fullName: 'Other Person' },
    ...over,
  }) as unknown as MessageWithNames;

describe('ChatService', () => {
  let repo: jest.Mocked<ChatRepository>;
  let gateway: jest.Mocked<ChatGateway>;
  let notifications: jest.Mocked<NotificationsService>;
  let service: ChatService;

  beforeEach(() => {
    repo = {
      create: jest.fn().mockResolvedValue(message()),
      userExists: jest.fn().mockResolvedValue({ id: 'other' }),
      thread: jest.fn().mockResolvedValue([[message()], 1]),
      markThreadRead: jest.fn().mockResolvedValue(1),
      recentInvolving: jest.fn().mockResolvedValue([withNames()]),
      unreadBySender: jest.fn().mockResolvedValue(new Map([['other', 2]])),
    } as unknown as jest.Mocked<ChatRepository>;
    gateway = { emitToUser: jest.fn() } as unknown as jest.Mocked<ChatGateway>;
    notifications = { notify: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<NotificationsService>;
    service = new ChatService(repo, gateway, notifications);
  });

  it('sends a message, pushes it, and notifies the recipient', async () => {
    await service.send(me, { receiverId: 'other', body: 'Hello there' });
    expect(gateway.emitToUser).toHaveBeenCalledWith(
      'other',
      CHAT_MESSAGE_EVENT,
      expect.objectContaining({ body: 'Hello there' }),
    );
    expect(notifications.notify).toHaveBeenCalledWith(
      'other',
      NotificationType.NEW_MESSAGE,
      'New message',
      expect.any(String),
      expect.objectContaining({ senderId: 'me' }),
    );
  });

  it('rejects messaging yourself', async () => {
    await expect(
      service.send(me, { receiverId: 'me', body: 'hi' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s for an unknown recipient', async () => {
    repo.userExists.mockResolvedValue(null);
    await expect(
      service.send(me, { receiverId: 'ghost', body: 'hi' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marks a thread read when opened', async () => {
    await service.thread(me, 'other', 1, 50);
    expect(repo.markThreadRead).toHaveBeenCalledWith('me', 'other');
  });

  it('reduces messages to one conversation per partner with unread counts', async () => {
    const convos = await service.conversations(me);
    expect(convos).toHaveLength(1);
    expect(convos[0]).toMatchObject({
      partner: { id: 'other', fullName: 'Other Person' },
      unread: 2,
    });
  });
});
