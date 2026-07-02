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

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('900s'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_TTL: z.string().default('30d'),

  // Optional integrations — required only once their stage ships.
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  FLUTTERWAVE_WEBHOOK_HASH: z.string().optional(),
  CLOUDINARY_URL: z.string().optional(),
  AFRICASTALKING_API_KEY: z.string().optional(),
  AFRICASTALKING_USERNAME: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** ConfigModule `validate` hook. Throws a readable error on misconfiguration. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
