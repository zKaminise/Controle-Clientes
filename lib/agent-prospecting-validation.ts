import { z } from 'zod';

const nullableText = z.string().trim().max(10_000).nullable().optional();
const nullableShortText = z.string().trim().max(500).nullable().optional();
const nullableUrl = z.string().trim().url().max(2_000).nullable().optional();
const nullableEmail = z.string().trim().email().max(320).nullable().optional();
const phone = z
  .string()
  .trim()
  .regex(/^[+()\-\s\d]{8,24}$/)
  .nullable()
  .optional();
const timestamp = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value));

export const prospectingBatchStatusSchema = z.enum([
  'draft',
  'researching',
  'review',
  'completed',
  'cancelled',
]);

export const prospectingCandidateStatusSchema = z.enum([
  'review',
  'approved',
  'ignored',
  'later',
  'promoted',
]);

export const agentCreateProspectingBatchSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    industry: nullableShortText,
    city: nullableShortText,
    state: z.string().trim().length(2).toUpperCase().nullable().optional(),
    desiredQuantity: z.number().int().min(1).max(100).default(20),
    criteria: nullableText,
    status: prospectingBatchStatusSchema.default('draft'),
  })
  .strict();

export const publicEvidenceSchema = z
  .object({
    url: z.string().trim().url().max(2_000),
    label: nullableShortText,
    note: nullableShortText,
  })
  .strict();

export const agentAddProspectingCandidateSchema = z
  .object({
    batchId: z.string().uuid(),
    companyName: z.string().trim().min(1).max(255),
    industry: nullableShortText,
    city: nullableShortText,
    state: z.string().trim().length(2).toUpperCase().nullable().optional(),
    publicPhone: phone,
    publicEmail: nullableEmail,
    website: nullableUrl,
    instagram: nullableUrl,
    otherNetworks: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(255),
            url: z.string().trim().url().max(2_000),
          })
          .strict(),
      )
      .max(20)
      .default([]),
    digitalPresence: nullableText,
    hasSite: z.boolean().default(false),
    siteStatus: z
      .enum([
        'SEM_SITE',
        'SITE_RUIM',
        'SITE_DEFASADO',
        'SITE_MEDIANO',
        'SITE_BOM',
        'NAO_ANALISADO',
      ])
      .default('NAO_ANALISADO'),
    score: z.number().int().min(0).max(100).default(0),
    scoreReasons: z
      .array(z.string().trim().min(1).max(500))
      .max(30)
      .default([]),
    observations: nullableText,
    evidence: z
      .array(publicEvidenceSchema)
      .min(1, 'Ao menos uma fonte pública verificável é obrigatória.')
      .max(30),
    suggestedMessage: nullableText,
    status: prospectingCandidateStatusSchema.default('review'),
    researchedAt: timestamp.nullable().optional(),
  })
  .strict();

export const agentUpdateProspectingCandidateSchema =
  agentAddProspectingCandidateSchema
    .omit({ batchId: true })
    .partial()
    .extend({ expectedUpdatedAt: timestamp })
    .strict()
    .refine(
      (value) => Object.keys(value).some((key) => key !== 'expectedUpdatedAt'),
      'Informe ao menos um campo para atualizar.',
    );
