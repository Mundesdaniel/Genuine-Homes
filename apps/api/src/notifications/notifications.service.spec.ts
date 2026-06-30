import type { Notification } from '@prisma/client';
import { NotificationType, PaymentPurpose, UserRole } from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import type { InstallmentReminderEvent } from '../installments/installment-events';
import type { PaymentSucceededEvent } from '../payments/payment-events';
import type { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';
import type {
  NotificationSender,
  OutboundNotification,
} from './senders/notification-sender.interface';

const user: AuthenticatedUser = { id: 'user-1', role: UserRole.USER };

const row = (over: Partial<Notification> = {}): Notification =>
  ({
    id: 'n-1',
    userId: user.id,
    type: NotificationType.PAYMENT_SUCCESSFUL,
    payload: { title: 'Deposit received', body: 'We received your deposit.', paymentId: 'pay-1' },
    readAt: null,
    createdAt: new Date('2026-06-01T00:00:00Z'),
    ...over,
  }) as unknown as Notification;

const reminder = (
  over: Partial<InstallmentReminderEvent> = {},
): InstallmentReminderEvent => ({
  buyerId: user.id,
  planId: 'plan-1',
  installmentId: 'item-1',
  sequence: 3,
  amount: 2_666_666,
  currency: 'UGX',
  dueDate: '2026-06-03',
  ...over,
});

describe('NotificationsService', () => {
  let repo: jest.Mocked<NotificationsRepository>;
  let sender: NotificationSender & { send: jest.Mock };
  let service: NotificationsService;

  beforeEach(() => {
    repo = {
      create: jest.fn().mockResolvedValue(row()),
      listByUser: jest.fn().mockResolvedValue([[row()], 1]),
      countUnread: jest.fn().mockResolvedValue(2),
      markRead: jest.fn().mockResolvedValue(1),
      markAllRead: jest.fn().mockResolvedValue(2),
      existsForReference: jest.fn().mockResolvedValue(false),
      findUserContact: jest
        .fn()
        .mockResolvedValue({ fullName: 'Ada', phone: '+256700000000', email: null }),
    } as unknown as jest.Mocked<NotificationsRepository>;
    sender = { channel: 'test', send: jest.fn().mockResolvedValue(undefined) };
    service = new NotificationsService(repo, [sender]);
  });

  it('lists notifications mapped to the response shape', async () => {
    const page = await service.listMine(user, 1, 20);
    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({
      id: 'n-1',
      title: 'Deposit received',
      data: { paymentId: 'pay-1' },
    });
    // title/body are pulled out of payload, not left inside `data`.
    expect(page.items[0].data).not.toHaveProperty('title');
  });

  it('returns the unread count', async () => {
    expect(await service.unreadCount(user)).toEqual({ unread: 2 });
  });

  it('marks one read scoped to the user and re-reports the count', async () => {
    await service.markRead(user, 'n-1');
    expect(repo.markRead).toHaveBeenCalledWith(user.id, 'n-1');
  });

  it('writes + dispatches a notification when a payment succeeds', async () => {
    const event: PaymentSucceededEvent = {
      paymentId: 'pay-1',
      userId: user.id,
      purpose: PaymentPurpose.DEPOSIT,
      referenceId: 'plan-1',
      amount: 16_000_000,
    };
    await service.onPaymentSucceeded(event);

    expect(repo.create).toHaveBeenCalledWith(
      user.id,
      NotificationType.PAYMENT_SUCCESSFUL,
      expect.objectContaining({ title: 'Deposit received' }),
    );
    const outbound = sender.send.mock.calls[0][0] as OutboundNotification;
    expect(outbound.phone).toBe('+256700000000');
    expect(outbound.type).toBe(NotificationType.PAYMENT_SUCCESSFUL);
  });

  it('creates a due-soon reminder once and skips duplicates', async () => {
    await service.onInstallmentDueSoon(reminder());
    expect(repo.create).toHaveBeenCalledWith(
      user.id,
      NotificationType.INSTALLMENT_DUE_SOON,
      expect.objectContaining({ installmentId: 'item-1' }),
    );

    repo.create.mockClear();
    repo.existsForReference.mockResolvedValue(true);
    await service.onInstallmentDueSoon(reminder());
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('isolates a failing sender so it never throws back into the emitter', async () => {
    sender.send.mockRejectedValueOnce(new Error('sms down'));
    await expect(
      service.onPaymentFailed({
        paymentId: 'pay-2',
        userId: user.id,
        purpose: PaymentPurpose.INSTALLMENT,
        referenceId: 'item-1',
        amount: 1000,
      }),
    ).resolves.toBeUndefined();
  });
});
