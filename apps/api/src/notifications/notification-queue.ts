import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import type { Env } from '../config/env.validation';
import { NotificationDispatcher, type QueuedNotification } from './notification-dispatcher';

const QUEUE_NAME = 'notifications';

/** ioredis connection options from a redis:// URL. `maxRetriesPerRequest:
 *  null` is required by BullMQ workers; `enableOfflineQueue: false` makes
 *  enqueue fail fast during an outage so we can fall back to inline delivery
 *  instead of buffering into the void. */
function redisConnection(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : 0,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
  };
}

/**
 * Durable notification fan-out on BullMQ (Redis). Producers enqueue; a worker
 * in the same process delivers with retry + exponential backoff, so an SMS
 * provider hiccup no longer loses reminders.
 *
 * Modes (NOTIFICATIONS_QUEUE, default: redis — inline under NODE_ENV=test):
 *  - redis:  jobs persist in Redis; 5 attempts, 30s exponential backoff.
 *  - inline: deliver synchronously in-process (no Redis dependency).
 * If Redis is unreachable at enqueue time, delivery transparently falls back
 * to inline so notifications still go out.
 */
@Injectable()
export class NotificationQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationQueue.name);
  private readonly mode: 'inline' | 'redis';
  private queue: Queue<QueuedNotification> | null = null;
  private worker: Worker<QueuedNotification> | null = null;
  private lastConnWarn = 0;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly dispatcher: NotificationDispatcher,
  ) {
    this.mode =
      this.config.get('NOTIFICATIONS_QUEUE', { infer: true }) ??
      (this.config.get('NODE_ENV', { infer: true }) === 'test' ? 'inline' : 'redis');
  }

  onModuleInit(): void {
    if (this.mode !== 'redis') {
      this.logger.log('Notification queue: inline (no Redis)');
      return;
    }
    const connection = redisConnection(this.config.get('REDIS_URL', { infer: true }));
    this.queue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
    this.worker = new Worker<QueuedNotification>(
      QUEUE_NAME,
      async (job) => this.dispatcher.deliver(job.data),
      { connection, concurrency: 5 },
    );
    // Connection errors are transient by design — warn (throttled), don't crash.
    const warn = (err: Error) => {
      const now = Date.now();
      if (now - this.lastConnWarn > 30_000) {
        this.lastConnWarn = now;
        this.logger.warn(`Notification queue Redis error: ${err.message}`);
      }
    };
    this.queue.on('error', warn);
    this.worker.on('error', warn);
    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Notification job ${job?.id ?? '?'} attempt ${job?.attemptsMade ?? '?'} failed: ${err.message}`,
      );
      // Only alert once retries are exhausted — transient flaps self-heal.
      if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
        Sentry.captureException(err, {
          tags: { queue: QUEUE_NAME },
          extra: { jobId: job.id, userId: job.data.userId, type: job.data.type },
        });
      }
    });
    this.logger.log('Notification queue: BullMQ (redis)');
  }

  async onModuleDestroy(): Promise<void> {
    // force=true: don't wait for a Redis that may be unreachable at shutdown.
    await this.worker?.close(true).catch(() => undefined);
    await this.queue?.close().catch(() => undefined);
  }

  /** Enqueue for durable delivery; degrade to inline if Redis is unavailable. */
  async enqueue(payload: QueuedNotification): Promise<void> {
    if (!this.queue) {
      await this.dispatcher.deliver(payload);
      return;
    }
    try {
      // BullMQ waits for a ready connection, so a Redis outage would hang the
      // caller — bound the wait and fall back to inline delivery instead.
      // (If the add straggles in later anyway, the worst case is a duplicate
      // channel send — preferable to a lost payment reminder.)
      await this.withTimeout(this.queue.add('deliver', payload), 3_000);
    } catch (err) {
      this.logger.warn(`Enqueue failed (${String(err)}) — delivering inline as fallback`);
      await this.dispatcher.deliver(payload);
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
      timer.unref?.();
      promise.then(resolve, reject).finally(() => clearTimeout(timer));
    });
  }
}
