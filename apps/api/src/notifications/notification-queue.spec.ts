import type { ConfigService } from '@nestjs/config';
import { NotificationType } from '@genuine-homes/shared';
import type { Env } from '../config/env.validation';
import type {
  NotificationDispatcher,
  QueuedNotification,
} from './notification-dispatcher';
import { NotificationQueue } from './notification-queue';

const config = (env: Record<string, string>) =>
  ({ get: (key: string) => env[key] }) as unknown as ConfigService<Env, true>;

const payload: QueuedNotification = {
  userId: 'user-1',
  type: NotificationType.PAYMENT_SUCCESSFUL,
  title: 'Payment received',
  body: 'Your payment was successful.',
};

describe('NotificationQueue', () => {
  let dispatcher: jest.Mocked<NotificationDispatcher>;

  beforeEach(() => {
    dispatcher = {
      deliver: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<NotificationDispatcher>;
  });

  it('delivers inline under NODE_ENV=test (no Redis)', async () => {
    const queue = new NotificationQueue(config({ NODE_ENV: 'test' }), dispatcher);
    queue.onModuleInit();
    await queue.enqueue(payload);
    expect(dispatcher.deliver).toHaveBeenCalledWith(payload);
  });

  it('respects an explicit NOTIFICATIONS_QUEUE=inline override', async () => {
    const queue = new NotificationQueue(
      config({ NODE_ENV: 'production', NOTIFICATIONS_QUEUE: 'inline' }),
      dispatcher,
    );
    queue.onModuleInit();
    await queue.enqueue(payload);
    expect(dispatcher.deliver).toHaveBeenCalledWith(payload);
  });

  it('falls back to inline delivery when Redis is unreachable', async () => {
    const queue = new NotificationQueue(
      // Redis mode, but pointing at a port nothing listens on: the bounded
      // enqueue wait (3s) elapses and delivery degrades to inline.
      config({ NODE_ENV: 'development', REDIS_URL: 'redis://127.0.0.1:1' }),
      dispatcher,
    );
    queue.onModuleInit();
    try {
      await queue.enqueue(payload);
      expect(dispatcher.deliver).toHaveBeenCalledWith(payload);
    } finally {
      await queue.onModuleDestroy();
    }
  }, 15_000);
});
