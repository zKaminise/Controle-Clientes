import { z } from 'zod';
import { APP_TIMEZONE, isoDateInTimeZone } from '@/lib/business';
import { prospectingStatus, scoreLevel } from '@/lib/validation';

const dateOnly = z
  .string()
  .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T12:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, 'Data inválida.');
const booleanQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

export const agentLeadSearchSchema = z
  .object({
    query: z.string().trim().min(1).max(200).optional(),
    industry: z.string().trim().min(1).max(255).optional(),
    city: z.string().trim().min(1).max(255).optional(),
    state: z.string().trim().length(2).toUpperCase().optional(),
    lifecycleStatus: z
      .enum(['lead', 'prospect', 'client', 'former_client', 'partner'])
      .optional(),
    prospectingStatus: prospectingStatus.optional(),
    siteStatus: z
      .enum([
        'SEM_SITE',
        'SITE_RUIM',
        'SITE_DEFASADO',
        'SITE_MEDIANO',
        'SITE_BOM',
        'NAO_ANALISADO',
      ])
      .optional(),
    priority: scoreLevel.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export const agentFollowUpQuerySchema = z
  .object({
    bucket: z
      .enum(['overdue', 'today', 'upcoming', 'without_action'])
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const agentAttentionQuerySchema = z
  .object({
    type: z
      .enum(['task', 'charge', 'domain', 'meeting', 'lead_without_action'])
      .optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.from && value.to && value.from > value.to) {
      context.addIssue({
        code: 'custom',
        path: ['from'],
        message: 'A data inicial deve ser anterior à final.',
      });
    }
  });

export const agentMetricsQuerySchema = z
  .object({
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    timezone: z.literal(APP_TIMEZONE).default(APP_TIMEZONE),
    comparePrevious: booleanQuery.default(false),
  })
  .strict()
  .transform((value) => {
    const today = isoDateInTimeZone(new Date(), value.timezone);
    return {
      ...value,
      from: value.from || `${today.slice(0, 8)}01`,
      to: value.to || today,
    };
  })
  .superRefine((value, context) => {
    if (value.from > value.to) {
      context.addIssue({
        code: 'custom',
        path: ['from'],
        message: 'A data inicial deve ser anterior à final.',
      });
    }
  });

export function strictSearchParams(request: Request) {
  const result: Record<string, string> = {};
  const searchParams = new URL(request.url).searchParams;
  for (const [key, value] of searchParams.entries()) {
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      throw new z.ZodError([
        {
          code: 'custom',
          path: [key],
          message: 'Parâmetro repetido não é permitido.',
        },
      ]);
    }
    result[key] = value;
  }
  return result;
}
