import { z } from 'zod';

const nullableText = z.preprocess(
  (value) => (value === '' ? null : value),
  z.string().trim().max(10_000).nullable().optional(),
);
const shortText = z.string().trim().min(1).max(255);
const nullableShortText = z.preprocess(
  (value) => (value === '' ? null : value),
  z.string().trim().max(500).nullable().optional(),
);
const nullableEmail = z.preprocess(
  (value) => (value === '' ? null : value),
  z.string().trim().email().max(320).nullable().optional(),
);
const nullableUrl = z.preprocess(
  (value) => (value === '' ? null : value),
  z.string().trim().url().max(2_000).nullable().optional(),
);
const uuid = z.string().uuid();
const nullableUuid = z.preprocess(
  (value) => (value === '' ? null : value),
  uuid.nullable().optional(),
);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nullableDate = z.preprocess(
  (value) => (value === '' ? null : value),
  dateOnly.nullable().optional(),
);
const nullableTimestamp = z.preprocess(
  (value) => (value === '' ? null : value),
  z
    .union([z.string(), z.date()])
    .nullable()
    .optional()
    .transform((value, context) => {
      if (!value) return value;
      const parsed =
        value instanceof Date
          ? value
          : new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value);
      if (Number.isNaN(parsed.getTime())) {
        context.addIssue({
          code: 'custom',
          message: 'Data e horário inválidos.',
        });
        return z.NEVER;
      }
      return parsed;
    }),
);
const money = z.union([z.string(), z.number()]).transform((value, context) => {
  const normalized =
    typeof value === 'number'
      ? value.toFixed(2)
      : value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    context.addIssue({ code: 'custom', message: 'Valor monetário inválido.' });
    return z.NEVER;
  }
  return Number(normalized).toFixed(2);
});
const nullableMoney = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  money.optional(),
);
const phone = z.preprocess(
  (value) => (value === '' ? null : value),
  z
    .string()
    .trim()
    .regex(/^[+()\-\s\d]{8,24}$/)
    .nullable()
    .optional(),
);
const nullableRating = z.preprocess(
  (value) => (value === '' || value === null ? null : value),
  z.coerce.number().int().min(0).max(5).nullable().optional(),
);
export const scoreLevel = z.enum(['BAIXA', 'MEDIA', 'ALTA', 'MUITO_ALTA']);
export const prospectingStatus = z.enum([
  'NOVO_LEAD',
  'PESQUISANDO',
  'PRONTO_PARA_CONTATO',
  'CONTATO_WHATSAPP',
  'CONTATO_EMAIL',
  'CONTATO_TELEFONE',
  'SEM_RESPOSTA',
  'RESPONDEU',
  'INTERESSADO',
  'REUNIAO_AGENDADA',
  'REUNIAO_REALIZADA',
  'PROPOSTA_ENVIADA',
  'NEGOCIACAO',
  'FOLLOWUP_FUTURO',
  'FECHADO',
  'PERDIDO',
  'DESCARTADO',
  'NUMERO_INVALIDO',
  'EMAIL_INVALIDO',
  'JA_POSSUI_FORNECEDOR',
  'SEM_INTERESSE',
]);

const companiesSchema = z
  .object({
    name: shortText,
    tradeName: nullableShortText,
    legalName: nullableShortText,
    document: nullableShortText,
    website: nullableUrl,
    instagram: nullableShortText,
    email: nullableEmail,
    phone,
    whatsapp: phone,
    city: nullableShortText,
    state: z.preprocess(
      (value) => (value === '' ? null : value),
      z.string().trim().length(2).toUpperCase().nullable().optional(),
    ),
    industry: nullableShortText,
    primaryContactName: nullableShortText,
    lifecycleStatus: z
      .enum(['lead', 'prospect', 'client', 'former_client', 'partner'])
      .default('lead'),
    relationshipStatus: z
      .enum(['active_recurring', 'active_non_recurring', 'inactive'])
      .default('inactive'),
    leadSource: nullableShortText,
    sourceUrl: nullableUrl,
    prospectingStatus: prospectingStatus.default('NOVO_LEAD'),
    referredByCompanyId: nullableUuid,
    healthStatus: z.enum(['good', 'attention', 'critical']).default('good'),
    lastContactAt: nullableTimestamp,
    nextContactAt: nullableTimestamp,
    contactFrequencyMonths: z.coerce
      .number()
      .int()
      .min(1)
      .max(60)
      .nullable()
      .optional(),
    nextAction: nullableText,
    nextActionAt: nullableTimestamp,
    notesSummary: nullableText,
  })
  .strict();

const digitalAnalysesSchema = z
  .object({
    companyId: uuid,
    hasSite: z.coerce.boolean().default(false),
    websiteUrl: nullableUrl,
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
    overallQuality: nullableRating,
    mobileQuality: nullableRating,
    speedQuality: nullableRating,
    designQuality: nullableRating,
    valuePropositionQuality: nullableRating,
    ctaQuality: nullableRating,
    hasWhatsappIntegration: z.boolean().nullable().optional(),
    hasBasicSeo: z.boolean().nullable().optional(),
    hasHttps: z.boolean().nullable().optional(),
    hasBrokenLinks: z.boolean().nullable().optional(),
    hasActiveDigitalPresence: z.boolean().nullable().optional(),
    issues: nullableText,
    opportunities: nullableText,
    scoreOverride: z.preprocess(
      (value) => (value === '' || value === null ? null : value),
      z.coerce.number().int().min(0).max(100).nullable().optional(),
    ),
    priority: scoreLevel.default('BAIXA'),
  })
  .strict();

const contactsSchema = z
  .object({
    companyId: uuid,
    name: shortText,
    role: nullableShortText,
    email: nullableEmail,
    phone,
    whatsapp: phone,
    isPrimary: z.coerce.boolean().default(false),
    isFinancialContact: z.coerce.boolean().default(false),
    notes: nullableText,
  })
  .strict();

const pipelineStagesSchema = z
  .object({
    name: shortText,
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9_-]+$/)
      .max(64),
    position: z.coerce.number().int().min(0),
    color: nullableShortText,
    metadata: z.record(z.string(), z.unknown()).optional(),
    isWon: z.coerce.boolean().default(false),
    isLost: z.coerce.boolean().default(false),
    isActive: z.coerce.boolean().default(true),
  })
  .strict()
  .refine(
    (value) => !(value.isWon && value.isLost),
    'Um estágio não pode ser ganho e perdido ao mesmo tempo.',
  );

const opportunitiesSchema = z
  .object({
    companyId: uuid,
    pipelineStageId: uuid,
    title: shortText,
    estimatedValue: nullableMoney,
    probability: z.coerce.number().int().min(0).max(100).default(20),
    leadSource: nullableShortText,
    expectedCloseDate: nullableDate,
    nextAction: nullableText,
    nextActionAt: nullableTimestamp,
    lostReason: nullableText,
  })
  .strict();

const projectsSchema = z
  .object({
    companyId: uuid,
    name: shortText,
    type: z
      .enum([
        'landing_page',
        'institutional',
        'ecommerce',
        'web_system',
        'maintenance',
        'other',
      ])
      .default('other'),
    status: z
      .enum([
        'proposal',
        'development',
        'review',
        'delivered',
        'maintenance',
        'archived',
      ])
      .default('proposal'),
    productionUrl: nullableUrl,
    stagingUrl: nullableUrl,
    repositoryUrl: nullableUrl,
    startDate: nullableDate,
    deliveryDate: nullableDate,
    soldValue: nullableMoney,
    costValue: nullableMoney,
    notes: nullableText,
  })
  .strict();

const domainsSchema = z
  .object({
    companyId: uuid,
    projectId: nullableUuid,
    domain: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/),
    registrar: nullableShortText,
    registrationDate: nullableDate,
    expirationDate: dateOnly,
    autoRenew: z.coerce.boolean().default(false),
    responsibility: z.enum(['me', 'client', 'third_party']).default('client'),
    registeredUnderMyAccount: z.coerce.boolean().default(false),
    registeredUnderClientDocument: z.coerce.boolean().default(false),
    renewalCost: nullableMoney,
    clientRenewalPrice: nullableMoney,
    status: z
      .enum(['active', 'expiring', 'expired', 'transferred'])
      .default('active'),
    notes: nullableText,
  })
  .strict();

const hostingServicesSchema = z
  .object({
    companyId: uuid,
    projectId: nullableUuid,
    provider: shortText,
    plan: nullableShortText,
    isFree: z.coerce.boolean().default(false),
    billingFrequency: z
      .enum(['monthly', 'quarterly', 'semiannual', 'annual', 'custom'])
      .default('monthly'),
    cost: nullableMoney,
    paidBy: z.enum(['me', 'client', 'third_party']).default('me'),
    renewalDate: nullableDate,
    dashboardUrl: nullableUrl,
    notes: nullableText,
    status: z.enum(['active', 'inactive', 'cancelled']).default('active'),
  })
  .strict();

const emailServicesSchema = z
  .object({
    companyId: uuid,
    projectId: nullableUuid,
    provider: shortText,
    accountEmail: nullableEmail,
    verifiedDomain: nullableShortText,
    senderDomain: nullableShortText,
    senderAddress: nullableEmail,
    status: z.enum(['active', 'inactive', 'cancelled']).default('active'),
    dashboardUrl: nullableUrl,
    credentialReference: nullableText,
    notes: nullableText,
  })
  .strict();

const servicesSchema = z
  .object({
    name: shortText,
    description: nullableText,
    defaultAmount: nullableMoney,
    active: z.coerce.boolean().default(true),
  })
  .strict();

const subscriptionsSchema = z
  .object({
    companyId: uuid,
    projectId: nullableUuid,
    serviceId: nullableUuid,
    description: shortText,
    amount: money,
    frequency: z
      .enum(['monthly', 'quarterly', 'semiannual', 'annual', 'custom'])
      .default('monthly'),
    customIntervalMonths: z.coerce
      .number()
      .int()
      .min(1)
      .max(60)
      .nullable()
      .optional(),
    billingDay: z.coerce.number().int().min(1).max(31),
    startDate: dateOnly,
    endDate: nullableDate,
    nextChargeDate: dateOnly,
    status: z
      .enum(['active', 'paused', 'cancelled', 'finished'])
      .default('active'),
  })
  .strict();

const chargesSchema = z
  .object({
    companyId: uuid,
    projectId: nullableUuid,
    subscriptionId: nullableUuid,
    description: shortText,
    category: z.string().trim().min(1).max(80).default('service'),
    amount: money,
    dueDate: dateOnly,
    billingPeriod: z.preprocess(
      (value) => (value === '' ? null : value),
      z
        .string()
        .regex(/^\d{4}-\d{2}$/)
        .nullable()
        .optional(),
    ),
    status: z
      .enum(['scheduled', 'pending', 'overdue', 'cancelled'])
      .default('pending'),
    notes: nullableText,
  })
  .strict();

const proposalsSchema = z
  .object({
    companyId: uuid,
    opportunityId: nullableUuid,
    title: shortText,
    description: nullableText,
    subtotal: money,
    discount: nullableMoney,
    finalAmount: money,
    paymentTerms: nullableText,
    validUntil: nullableDate,
    status: z
      .enum(['draft', 'sent', 'negotiation', 'accepted', 'rejected', 'expired'])
      .default('draft'),
    notes: nullableText,
  })
  .strict();

const meetingsSchema = z
  .object({
    companyId: uuid,
    opportunityId: nullableUuid,
    title: shortText,
    meetingAt: nullableTimestamp.refine(Boolean, 'Data da reunião obrigatória'),
    type: z
      .enum(['google_meet', 'teams', 'phone', 'in_person', 'other'])
      .default('other'),
    meetingUrl: nullableUrl,
    location: nullableShortText,
    notes: nullableText,
    result: nullableText,
    nextAction: nullableText,
    nextActionAt: nullableTimestamp,
  })
  .strict();

const tasksSchema = z
  .object({
    companyId: nullableUuid,
    opportunityId: nullableUuid,
    projectId: nullableUuid,
    chargeId: nullableUuid,
    domainId: nullableUuid,
    meetingId: nullableUuid,
    type: z.string().trim().min(1).max(80).default('general'),
    title: shortText,
    description: nullableText,
    reason: nullableText,
    reminderAt: nullableTimestamp,
    responsibleUserId: nullableUuid,
    priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    status: z
      .enum(['open', 'completed', 'snoozed', 'cancelled'])
      .default('open'),
    dueAt: nullableTimestamp.refine(Boolean, 'Data da tarefa obrigatória'),
    source: z.enum(['manual', 'automation']).default('manual'),
    idempotencyKey: nullableShortText,
  })
  .strict();

const interactionsSchema = z
  .object({
    companyId: uuid,
    opportunityId: nullableUuid,
    type: z
      .enum([
        'whatsapp',
        'email',
        'call',
        'instagram',
        'meeting',
        'note',
        'system',
        'other',
      ])
      .default('note'),
    subject: nullableShortText,
    content: z.string().trim().min(1).max(20_000),
    result: nullableText,
    notes: nullableText,
    responsibleUserId: nullableUuid,
    occurredAt: nullableTimestamp.transform((value) => value || new Date()),
    nextAction: nullableText,
    nextActionAt: nullableTimestamp,
  })
  .strict();

const messageTemplatesSchema = z
  .object({
    name: shortText,
    category: shortText,
    subject: nullableShortText,
    content: z.string().trim().min(1).max(20_000),
    channel: z.enum(['whatsapp', 'email']).default('whatsapp'),
  })
  .strict();

const tagsSchema = z
  .object({ name: shortText, color: nullableShortText })
  .strict();

const referralsSchema = z
  .object({
    referrerCompanyId: uuid,
    referredCompanyId: uuid,
    status: z
      .enum(['PENDENTE', 'CONTATADO', 'CONVERTIDO', 'PERDIDO'])
      .default('PENDENTE'),
    notes: nullableText,
  })
  .strict()
  .refine(
    (value) => value.referrerCompanyId !== value.referredCompanyId,
    'Uma empresa não pode indicar a si mesma.',
  );

const leadScoreRulesSchema = z
  .object({
    ruleKey: z
      .string()
      .trim()
      .regex(/^[a-z0-9_]+$/)
      .max(80),
    label: shortText,
    points: z.coerce.number().int().min(-100).max(100),
    enabled: z.coerce.boolean().default(true),
    position: z.coerce.number().int().min(0),
  })
  .strict();

export const entitySchemas = {
  companies: companiesSchema,
  digitalAnalyses: digitalAnalysesSchema,
  contacts: contactsSchema,
  pipelineStages: pipelineStagesSchema,
  opportunities: opportunitiesSchema,
  projects: projectsSchema,
  domains: domainsSchema,
  hostingServices: hostingServicesSchema,
  emailServices: emailServicesSchema,
  services: servicesSchema,
  subscriptions: subscriptionsSchema,
  charges: chargesSchema,
  proposals: proposalsSchema,
  meetings: meetingsSchema,
  tasks: tasksSchema,
  interactions: interactionsSchema,
  referrals: referralsSchema,
  leadScoreRules: leadScoreRulesSchema,
  messageTemplates: messageTemplatesSchema,
  tags: tagsSchema,
} as const;

export const entityNameSchema = z.enum(
  Object.keys(entitySchemas) as [
    keyof typeof entitySchemas,
    ...(keyof typeof entitySchemas)[],
  ],
);
export type EntityName = z.infer<typeof entityNameSchema>;

export function parseEntityPayload(
  entity: EntityName,
  payload: unknown,
  partial = false,
) {
  const schema = entitySchemas[entity];
  return partial ? schema.partial().parse(payload) : schema.parse(payload);
}

export function parseCompanyPayload(payload: unknown) {
  return companiesSchema.parse(payload);
}

export function parseDigitalAnalysisPayload(payload: unknown) {
  return digitalAnalysesSchema.parse(payload);
}

export const mutationSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    entity: entityNameSchema,
    data: z.record(z.string(), z.unknown()),
  }),
  z.object({
    action: z.literal('update'),
    entity: entityNameSchema,
    id: uuid,
    data: z.record(z.string(), z.unknown()),
  }),
  z.object({
    action: z.enum(['archive', 'restore']),
    entity: entityNameSchema,
    id: uuid,
  }),
  z.object({
    action: z.literal('moveOpportunity'),
    id: uuid,
    pipelineStageId: uuid,
    lostReason: nullableText,
  }),
  z.object({
    action: z.literal('markPaid'),
    id: uuid,
    amount: money.optional(),
    paymentMethod: nullableShortText,
    reference: nullableShortText,
  }),
  z.object({
    action: z.literal('completeTask'),
    id: uuid,
    nextAction: z
      .object({ title: shortText, dueAt: nullableTimestamp })
      .optional(),
  }),
  z.object({
    action: z.literal('snoozeTask'),
    id: uuid,
    until: nullableTimestamp.refine(Boolean, 'Data obrigatória'),
  }),
  z.object({ action: z.literal('cancelTask'), id: uuid }),
  z.object({
    action: z.literal('markNotificationRead'),
    id: uuid.optional(),
    all: z.boolean().optional(),
  }),
  z.object({
    action: z.literal('addCompanyTag'),
    companyId: uuid,
    tagId: uuid,
  }),
  z.object({
    action: z.literal('removeCompanyTag'),
    companyId: uuid,
    tagId: uuid,
  }),
  z.object({
    action: z.literal('updateSettings'),
    data: z
      .object({
        businessName: shortText,
        timezone: shortText,
        currency: z
          .string()
          .trim()
          .length(3)
          .transform((value) => value.toUpperCase()),
        theme: z.enum(['light', 'dark', 'system']),
        domainAlertDays: z
          .array(z.number().int().min(0).max(365))
          .min(1)
          .max(12),
        defaultPostSaleMonths: z.number().int().min(1).max(120),
      })
      .strict(),
  }),
]);
