import { z } from 'zod';

function trimEnvironmentValue(value: unknown) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

const requiredString = (name: string) =>
  z.preprocess(
    trimEnvironmentValue,
    z
      .string({ error: `${name} é obrigatória.` })
      .min(1, `${name} é obrigatória.`),
  );

const requiredUrl = (name: string) =>
  z.preprocess(
    trimEnvironmentValue,
    z.url({ error: `${name} deve ser uma URL absoluta válida.` }),
  );

const optionalString = z.preprocess(
  trimEnvironmentValue,
  z.string().min(1).optional(),
);
const optionalEmail = z.preprocess(
  trimEnvironmentValue,
  z
    .email({
      error: 'RESEND_FROM_EMAIL deve ser um endereço de e-mail válido.',
    })
    .optional(),
);
const optionalAdminEmail = z.preprocess(
  trimEnvironmentValue,
  z
    .email({ error: 'E-mail administrativo da API de agentes inválido.' })
    .optional(),
);
const optionalUrl = z.preprocess(trimEnvironmentValue, z.url().optional());

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

const serverEnvSchema = z
  .object({
    DATABASE_URL: requiredUrl('DATABASE_URL'),
    BETTER_AUTH_SECRET: z.preprocess(
      trimEnvironmentValue,
      z
        .string({ error: 'BETTER_AUTH_SECRET é obrigatória.' })
        .min(32, 'BETTER_AUTH_SECRET deve ter ao menos 32 caracteres.'),
    ),
    BETTER_AUTH_URL: requiredUrl('BETTER_AUTH_URL'),
    NEXT_PUBLIC_APP_URL: requiredUrl('NEXT_PUBLIC_APP_URL'),
    APP_TIMEZONE: requiredString('APP_TIMEZONE').refine(
      isValidTimeZone,
      'APP_TIMEZONE deve ser uma timezone IANA válida.',
    ),
    CRON_SECRET: z.preprocess(
      trimEnvironmentValue,
      z
        .string({ error: 'CRON_SECRET é obrigatória.' })
        .min(32, 'CRON_SECRET deve ter ao menos 32 caracteres.'),
    ),
    RESEND_API_KEY: optionalString,
    RESEND_FROM_EMAIL: optionalEmail,
    RESEND_FROM_NAME: optionalString,
    ADMIN_EMAIL: optionalAdminEmail,
    AGENT_ALLOWED_ADMIN_EMAIL: optionalAdminEmail,
    AGENT_API_AUDIENCE: optionalUrl,
  })
  .superRefine((values, context) => {
    if (Boolean(values.RESEND_API_KEY) === Boolean(values.RESEND_FROM_EMAIL))
      return;

    context.addIssue({
      code: 'custom',
      path: values.RESEND_API_KEY ? ['RESEND_FROM_EMAIL'] : ['RESEND_API_KEY'],
      message:
        'RESEND_API_KEY e RESEND_FROM_EMAIL devem ser configuradas juntas.',
    });
  });

export function parseServerEnv(source: Record<string, unknown>) {
  return serverEnvSchema.parse(source);
}

export const env = parseServerEnv({
  DATABASE_URL: process.env.DATABASE_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  APP_TIMEZONE: process.env.APP_TIMEZONE,
  CRON_SECRET: process.env.CRON_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  RESEND_FROM_NAME: process.env.RESEND_FROM_NAME,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  AGENT_ALLOWED_ADMIN_EMAIL: process.env.AGENT_ALLOWED_ADMIN_EMAIL,
  AGENT_API_AUDIENCE: process.env.AGENT_API_AUDIENCE,
});

export function requireRuntimeEnv() {
  return env;
}
