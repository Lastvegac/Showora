import { config } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';
config({
  path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
  quiet: true,
});

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4400),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(64),
  CSRF_SECRET: z.string().min(64),
  MAIL_ENCRYPTION_KEY: z.string().regex(/^[a-f0-9]{64}$/),
  BASE_DOMAIN: z
    .string()
    .min(1)
    .regex(/^[a-z0-9.-]+$/),
  ADMIN_ORIGIN: z.string().url(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_SECURE: z.enum(['true', 'false']).default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().email(),
});
export type Settings = z.infer<typeof schema>;
export const SETTINGS = Symbol('SETTINGS');
export function loadSettings(): Settings {
  const result = schema.safeParse(process.env);
  if (!result.success)
    throw new Error(
      `Invalid environment: ${result.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    );
  const value = result.data;
  const origin = new URL(value.ADMIN_ORIGIN);
  if (origin.hostname !== value.BASE_DOMAIN || origin.pathname !== '/')
    throw new Error('ADMIN_ORIGIN must use BASE_DOMAIN and have no path');
  if (
    value.NODE_ENV === 'production' &&
    (origin.protocol !== 'https:' ||
      value.BASE_DOMAIN.endsWith('localhost') ||
      value.SMTP_SECURE !== 'true')
  )
    throw new Error('Production requires HTTPS, real domain and secure SMTP');
  return value;
}
