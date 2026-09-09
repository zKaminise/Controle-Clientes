import { z } from 'zod';
import { prospectingStatus, scoreLevel } from '@/lib/validation';

const uuid = z.string().uuid();
const trimmed = (max: number) => z.string().trim().min(1).max(max);
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const nullableEmail = z.string().trim().email().max(320).nullable().optional();
const nullableUrl = z.string().trim().url().max(2_000).nullable().optional();
const nullablePhone = z.string().trim().regex(/^[+()\-\s\d]{8,24}$/).nullable().optional();
const timestamp = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
const expectedUpdatedAt = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
const rating = z.number().int().min(0).max(5).nullable().optional();

export const agentIdempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);

const leadFields = {
  tradeName: nullableText(500),
  legalName: nullableText(500),
  document: nullableText(32),
  website: nullableUrl,
  instagram: nullableText(500),
  email: nullableEmail,
  phone: nullablePhone,
  whatsapp: nullablePhone,
  city: nullableText(255),
  state: z.string().trim().length(2).transform((value) => value.toUpperCase()).nullable().optional(),
  industry: nullableText(255),
  primaryContactName: nullableText(255),
  lifecycleStatus: z.enum(['lead', 'prospect', 'client', 'former_client', 'partner']).optional(),
  relationshipStatus: z.enum(['active_recurring', 'active_non_recurring', 'inactive']).optional(),
  leadSource: nullableText(255),
  sourceUrl: nullableUrl,
  prospectingStatus: prospectingStatus.optional(),
  referredByCompanyId: uuid.nullable().optional(),
  healthStatus: z.enum(['good', 'attention', 'critical']).optional(),
  nextContactAt: timestamp.nullable().optional(),
  contactFrequencyMonths: z.number().int().min(1).max(60).nullable().optional(),
  nextAction: nullableText(10_000),
  nextActionAt: timestamp.nullable().optional(),
  notesSummary: nullableText(10_000),
};

export const agentCreateLeadSchema = z
  .object({ name: trimmed(255), ...leadFields })
  .strict();

export const agentUpdateLeadSchema = z
  .object({
    expectedUpdatedAt,
    name: trimmed(255).optional(),
    ...leadFields,
  })
  .strict()
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'expectedUpdatedAt'),
    'Informe ao menos um campo para atualizar.',
  );

export const agentSetLeadStageSchema = z
  .object({
    expectedUpdatedAt,
    prospectingStatus,
    reason: nullableText(2_000),
  })
  .strict();

export const agentMoveOpportunitySchema = z
  .object({
    expectedUpdatedAt,
    pipelineStageId: uuid,
    reason: nullableText(2_000),
    lostReason: nullableText(2_000),
  })
  .strict();

export const agentCreateInteractionSchema = z
  .object({
    companyId: uuid,
    opportunityId: uuid.nullable().optional(),
    type: z.enum(['whatsapp', 'email', 'call', 'instagram', 'meeting', 'note', 'other']),
    subject: nullableText(500),
    content: trimmed(10_000),
    result: nullableText(2_000),
    notes: nullableText(10_000),
    occurredAt: timestamp.optional(),
    nextAction: nullableText(2_000),
    nextActionAt: timestamp.nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (Boolean(value.nextAction) !== Boolean(value.nextActionAt)) {
      context.addIssue({
        code: 'custom',
        path: ['nextAction'],
        message: 'nextAction e nextActionAt devem ser enviados juntos.',
      });
    }
  });

export const agentSetInteractionResultSchema = z
  .object({
    expectedUpdatedAt,
    result: trimmed(2_000),
    notes: nullableText(10_000),
    nextAction: nullableText(2_000),
    nextActionAt: timestamp.nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (Boolean(value.nextAction) !== Boolean(value.nextActionAt)) {
      context.addIssue({
        code: 'custom',
        path: ['nextAction'],
        message: 'nextAction e nextActionAt devem ser enviados juntos.',
      });
    }
  });

export const agentCreateFollowUpSchema = z
  .object({
    companyId: uuid,
    opportunityId: uuid.nullable().optional(),
    title: trimmed(255),
    description: nullableText(10_000),
    reason: nullableText(2_000),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    dueAt: timestamp,
    reminderAt: timestamp.nullable().optional(),
  })
  .strict();

export const agentCreateReferralSchema = z
  .object({
    referrerCompanyId: uuid,
    referredCompanyId: uuid,
    status: z.enum(['PENDENTE', 'CONTATADO', 'CONVERTIDO', 'PERDIDO']).default('PENDENTE'),
    notes: nullableText(10_000),
  })
  .strict()
  .refine((value) => value.referrerCompanyId !== value.referredCompanyId, {
    path: ['referredCompanyId'],
    message: 'A empresa indicada deve ser diferente da indicadora.',
  });

export const agentUpsertDigitalAnalysisSchema = z
  .object({
    expectedUpdatedAt: expectedUpdatedAt.optional(),
    hasSite: z.boolean().optional(),
    websiteUrl: nullableUrl,
    siteStatus: z
      .enum(['SEM_SITE', 'SITE_RUIM', 'SITE_DEFASADO', 'SITE_MEDIANO', 'SITE_BOM', 'NAO_ANALISADO'])
      .optional(),
    overallQuality: rating,
    mobileQuality: rating,
    speedQuality: rating,
    designQuality: rating,
    valuePropositionQuality: rating,
    ctaQuality: rating,
    hasWhatsappIntegration: z.boolean().nullable().optional(),
    hasBasicSeo: z.boolean().nullable().optional(),
    hasHttps: z.boolean().nullable().optional(),
    hasBrokenLinks: z.boolean().nullable().optional(),
    hasActiveDigitalPresence: z.boolean().nullable().optional(),
    issues: nullableText(10_000),
    opportunities: nullableText(10_000),
    scoreOverride: z.number().int().min(0).max(100).nullable().optional(),
    priority: scoreLevel.optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'expectedUpdatedAt'),
    'Informe ao menos um campo da análise.',
  );
