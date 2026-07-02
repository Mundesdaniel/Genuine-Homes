import { z } from 'zod';

/**
 * Environment variable schema. Validated once at boot so the app fails fast
 * with a clear error instead of misbehaving at runtime with a missing secret.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  // pino level; defaults to debug in dev, info in production.
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .optional(),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  // Absolute origin the API is reachable at, used to build URLs for locally
  // stored uploads (e.g. http://localhost:3100). Defaults to localhost:PORT.
  PUBLIC_API_URL: z.string().url().optional(),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  // Notification fan-out: `redis` = durable BullMQ queue (default outside
  // tests), `inline` = synchronous in-process delivery (no Redis needed).
  NOTIFICATIONS_QUEUE: z.enum(['inline', 'redis']).optional(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('900s'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_TTL: z.string().default('30d'),

  // Payment gateway selection. Unset → inferred: `flutterwave` when a secret
  // key is present, else `mock`. Production refuses the mock unless it was
  // chosen explicitly (a conscious, visible decision in the environment).
  PAYMENT_GATEWAY: z.enum(['mock', 'flutterwave']).optional(),

  // Optional integrations — required only once their stage ships.
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  FLUTTERWAVE_WEBHOOK_HASH: z.string().optional(),
  CLOUDINARY_URL: z.string().optional(),
  AFRICASTALKING_API_KEY: z.string().optional(),
  AFRICASTALKING_USERNAME: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** The gateway that will actually be instantiated for a given environment. */
export function resolvePaymentGateway(
  env: Pick<Env, 'PAYMENT_GATEWAY' | 'FLUTTERWAVE_SECRET_KEY'>,
): 'mock' | 'flutterwave' {
  return env.PAYMENT_GATEWAY ?? (env.FLUTTERWAVE_SECRET_KEY ? 'flutterwave' : 'mock');
}

/** Cross-field rules that a plain field schema can't express. */
const envSchemaWithRules = envSchema.superRefine((env, ctx) => {
  const gateway = resolvePaymentGateway(env);
  if (
    gateway === 'flutterwave' &&
    (!env.FLUTTERWAVE_SECRET_KEY || !env.FLUTTERWAVE_WEBHOOK_HASH)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['PAYMENT_GATEWAY'],
      message:
        'The Flutterwave gateway requires both FLUTTERWAVE_SECRET_KEY and FLUTTERWAVE_WEBHOOK_HASH',
    });
  }
  if (env.NODE_ENV === 'production' && gateway === 'mock' && env.PAYMENT_GATEWAY !== 'mock') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['PAYMENT_GATEWAY'],
      message:
        'Production requires the Flutterwave gateway (set FLUTTERWAVE_SECRET_KEY + FLUTTERWAVE_WEBHOOK_HASH). To knowingly run fake payments, set PAYMENT_GATEWAY=mock explicitly.',
    });
  }
});

/** ConfigModule `validate` hook. Throws a readable error on misconfiguration. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchemaWithRules.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
