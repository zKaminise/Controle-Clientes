import { z } from 'zod';

const optionalUrl = z.string().url().optional().or(z.literal(''));

const serverEnvSchema = z.object({
  DATABASE_URL: optionalUrl,
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: optionalUrl,
  NEXT_PUBLIC_APP_URL: optionalUrl,
  APP_TIMEZONE: z.string().default('America/Sao_Paulo'),
  CRON_SECRET: z.string().min(16).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  RESEND_FROM_NAME: z.string().min(1).optional(),
});

export const env = serverEnvSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  APP_TIMEZONE: process.env.APP_TIMEZONE,
  CRON_SECRET: process.env.CRON_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  RESEND_FROM_NAME: process.env.RESEND_FROM_NAME,
});

export function requireRuntimeEnv() {
  const missing = [
    ['DATABASE_URL', env.DATABASE_URL],
    ['BETTER_AUTH_SECRET', env.BETTER_AUTH_SECRET],
    ['BETTER_AUTH_URL', env.BETTER_AUTH_URL],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missing.length) {
    throw new Error(`Configuração pendente: ${missing.join(', ')}`);
  }
}
