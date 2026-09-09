import { createHash, randomUUID } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '@/db';
import {
  activities,
  agentIdempotencyKeys,
  companies,
  digitalAnalyses,
  interactions,
  leadScoreRules,
  opportunities,
  pipelineHistory,
  pipelineStages,
  prospectingBatches,
  prospectingCandidates,
  referrals,
  settings,
  tasks,
} from '@/db/schema';
import { AgentApiError } from '@/lib/agent-auth';
import {
  dateAtNoon,
  nextPostSaleDate,
  pipelineTransition,
} from '@/lib/business';
import {
  calculateLeadScore,
  DEFAULT_LEAD_SCORE_RULES,
  leadScoreLevel,
  normalizeDomainIdentity,
  normalizeEmailIdentity,
  normalizeNameCityIdentity,
  normalizePhoneIdentity,
} from '@/lib/crm';
import type {
  agentCreateFollowUpSchema,
  agentCreateInteractionSchema,
  agentCreateLeadSchema,
  agentCreateReferralSchema,
  agentMoveOpportunitySchema,
  agentSetInteractionResultSchema,
  agentSetLeadStageSchema,
  agentUpdateLeadSchema,
  agentUpsertDigitalAnalysisSchema,
} from '@/lib/agent-write-validation';
import type {
  agentAddProspectingCandidateSchema,
  agentCreateProspectingBatchSchema,
  agentUpdateProspectingCandidateSchema,
} from '@/lib/agent-prospecting-validation';

type CreateLeadInput = z.infer<typeof agentCreateLeadSchema>;
type UpdateLeadInput = z.infer<typeof agentUpdateLeadSchema>;
type SetLeadStageInput = z.infer<typeof agentSetLeadStageSchema>;
type MoveOpportunityInput = z.infer<typeof agentMoveOpportunitySchema>;
type CreateInteractionInput = z.infer<typeof agentCreateInteractionSchema>;
type SetInteractionResultInput = z.infer<
  typeof agentSetInteractionResultSchema
>;
type CreateFollowUpInput = z.infer<typeof agentCreateFollowUpSchema>;
type CreateReferralInput = z.infer<typeof agentCreateReferralSchema>;
type UpsertAnalysisInput = z.infer<typeof agentUpsertDigitalAnalysisSchema>;
type CreateProspectingBatchInput = z.infer<
  typeof agentCreateProspectingBatchSchema
>;
type AddProspectingCandidateInput = z.infer<
  typeof agentAddProspectingCandidateSchema
>;
type UpdateProspectingCandidateInput = z.infer<
  typeof agentUpdateProspectingCandidateSchema
>;

export type AgentWriteActor = {
  ownerUserId: string;
  actorKey: string;
};

export type AgentWriteResult<T> = {
  data: T;
  replayed: boolean;
  audit: {
    entityType: string;
    entityId: string;
    changes: Record<string, unknown>;
  };
};

function stableValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

function hash(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function postgresErrorCode(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (
      typeof current === 'object' &&
      current !== null &&
      'code' in current &&
      typeof (current as { code?: unknown }).code === 'string'
    )
      return (current as { code: string }).code;
    current =
      typeof current === 'object' && current !== null && 'cause' in current
        ? (current as { cause?: unknown }).cause
        : null;
  }
  return null;
}

function versionGuard<T extends { getSQL(): unknown }>(updated: T) {
  return sql<number>`1 / case when exists (select 1 from ${updated}) then 1 else 0 end`;
}

function assertExpected(actual: Date, expected: Date) {
  if (actual.getTime() !== expected.getTime()) {
    throw new AgentApiError(
      'AGENT_VERSION_CONFLICT',
      'O registro foi alterado depois da leitura. Consulte novamente antes de tentar outra escrita.',
      409,
      { currentUpdatedAt: actual.toISOString() },
    );
  }
}

function reservation(input: {
  actor: AgentWriteActor;
  actorHash: string;
  idempotencyKey: string;
  operation: string;
  requestHash: string;
  response: unknown;
  entityType: string;
  entityId: string;
  now: Date;
}) {
  return db.insert(agentIdempotencyKeys).values({
    ownerUserId: input.actor.ownerUserId,
    actorKey: input.actorHash,
    idempotencyKey: input.idempotencyKey,
    operation: input.operation,
    requestHash: input.requestHash,
    response: stableValue(input.response) as Record<string, unknown>,
    statusCode: 200,
    entityType: input.entityType,
    entityId: input.entityId,
    expiresAt: new Date(input.now.getTime() + 90 * 86_400_000),
  });
}

async function existingIdempotency(
  actor: AgentWriteActor,
  actorHash: string,
  idempotencyKey: string,
) {
  const [row] = await db
    .select()
    .from(agentIdempotencyKeys)
    .where(
      and(
        eq(agentIdempotencyKeys.ownerUserId, actor.ownerUserId),
        eq(agentIdempotencyKeys.actorKey, actorHash),
        eq(agentIdempotencyKeys.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);
  return row || null;
}

async function completedReplay<T>(input: {
  actor: AgentWriteActor;
  idempotencyKey: string;
  operation: string;
  request: unknown;
}): Promise<AgentWriteResult<T> | null> {
  const existing = await existingIdempotency(
    input.actor,
    hash(input.actor.actorKey),
    input.idempotencyKey,
  );
  if (!existing) return null;
  const requestHash = hash(JSON.stringify(stableValue(input.request)));
  if (
    existing.operation !== input.operation ||
    existing.requestHash !== requestHash
  ) {
    throw new AgentApiError(
      'AGENT_IDEMPOTENCY_CONFLICT',
      'A Idempotency-Key já foi usada com outra operação ou payload.',
      409,
    );
  }
  return {
    data: existing.response as T,
    replayed: true,
    audit: {
      entityType: existing.entityType || 'unknown',
      entityId: existing.entityId || 'unknown',
      changes: { replayed: true },
    },
  };
}

async function idempotentWrite<T>(input: {
  actor: AgentWriteActor;
  idempotencyKey: string;
  operation: string;
  request: unknown;
  response: T;
  audit: AgentWriteResult<T>['audit'];
  run: (reservationStatement: ReturnType<typeof reservation>) => Promise<void>;
}): Promise<AgentWriteResult<T>> {
  const actorHash = hash(input.actor.actorKey);
  const requestHash = hash(JSON.stringify(stableValue(input.request)));

  const replay = () => completedReplay<T>(input);
  const prior = await replay();
  if (prior) return prior;

  const now = new Date();
  try {
    await input.run(
      reservation({
        actor: input.actor,
        actorHash,
        idempotencyKey: input.idempotencyKey,
        operation: input.operation,
        requestHash,
        response: input.response,
        entityType: input.audit.entityType,
        entityId: input.audit.entityId,
        now,
      }),
    );
  } catch (error) {
    const errorCode = postgresErrorCode(error);
    if (errorCode === '23505') {
      const raced = await replay();
      if (raced) return raced;
    }
    if (errorCode === '22012') {
      throw new AgentApiError(
        'AGENT_VERSION_CONFLICT',
        'O registro foi alterado depois da leitura. Consulte novamente antes de tentar outra escrita.',
        409,
      );
    }
    throw error;
  }

  return { data: input.response, replayed: false, audit: input.audit };
}

function activity(input: {
  ownerUserId: string;
  companyId: string;
  entityType: string;
  entityId: string;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  return db
    .insert(activities)
    .values({ ...input, metadata: input.metadata || {} });
}

async function ownedCompany(ownerUserId: string, companyId: string) {
  const [company] = await db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.id, companyId),
        eq(companies.ownerUserId, ownerUserId),
        isNull(companies.archivedAt),
      ),
    )
    .limit(1);
  if (!company)
    throw new AgentApiError(
      'AGENT_LEAD_NOT_FOUND',
      'Lead não encontrado.',
      404,
    );
  return company;
}

async function ensureNoDuplicateLead(
  ownerUserId: string,
  input: CreateLeadInput,
  ignoredId?: string,
) {
  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      city: companies.city,
      document: companies.document,
      email: companies.email,
      phone: companies.phone,
      whatsapp: companies.whatsapp,
      website: companies.website,
    })
    .from(companies)
    .where(
      and(eq(companies.ownerUserId, ownerUserId), isNull(companies.archivedAt)),
    );
  const document = input.document?.replace(/\D/g, '') || '';
  const email = normalizeEmailIdentity(input.email);
  const phone = normalizePhoneIdentity(input.phone || input.whatsapp);
  const domain = normalizeDomainIdentity(input.website);
  const nameCity = normalizeNameCityIdentity(input.name, input.city);
  const duplicate = rows.find((row) => {
    if (row.id === ignoredId) return false;
    return Boolean(
      (document && row.document?.replace(/\D/g, '') === document) ||
      (email && normalizeEmailIdentity(row.email) === email) ||
      (phone && normalizePhoneIdentity(row.phone || row.whatsapp) === phone) ||
      (domain && normalizeDomainIdentity(row.website) === domain) ||
      (nameCity && normalizeNameCityIdentity(row.name, row.city) === nameCity),
    );
  });
  if (duplicate) {
    throw new AgentApiError(
      'AGENT_DUPLICATE_LEAD',
      'Já existe um lead com a mesma identidade principal.',
      409,
      { duplicateLeadId: duplicate.id },
    );
  }
}

export async function createAgentLead(
  actor: AgentWriteActor,
  idempotencyKey: string,
  input: CreateLeadInput,
) {
  const prior = await completedReplay<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
  }>({ actor, idempotencyKey, operation: 'crm_create_lead', request: input });
  if (prior) return prior;
  await ensureNoDuplicateLead(actor.ownerUserId, input);
  if (input.referredByCompanyId)
    await ownedCompany(actor.ownerUserId, input.referredByCompanyId);
  const id = randomUUID();
  const now = new Date();
  const response = { id, createdAt: now, updatedAt: now };
  return idempotentWrite({
    actor,
    idempotencyKey,
    operation: 'crm_create_lead',
    request: input,
    response,
    audit: {
      entityType: 'companies',
      entityId: id,
      changes: { before: null, after: input },
    },
    run: async (reserve) => {
      await db.batch([
        reserve,
        db
          .insert(companies)
          .values({
            id,
            ownerUserId: actor.ownerUserId,
            ...input,
            createdAt: now,
            updatedAt: now,
          }),
        activity({
          ownerUserId: actor.ownerUserId,
          companyId: id,
          entityType: 'companies',
          entityId: id,
          action: 'created',
          description: 'Lead criado por agente autorizado.',
          metadata: { source: 'agent' },
        }),
      ]);
    },
  });
}

export async function updateAgentLead(
  actor: AgentWriteActor,
  idempotencyKey: string,
  leadId: string,
  input: UpdateLeadInput,
) {
  const prior = await completedReplay<{ id: string; updatedAt: Date }>({
    actor,
    idempotencyKey,
    operation: 'crm_update_lead',
    request: { leadId, ...input },
  });
  if (prior) return prior;
  const current = await ownedCompany(actor.ownerUserId, leadId);
  assertExpected(current.updatedAt, input.expectedUpdatedAt);
  const { expectedUpdatedAt, ...changes } = input;
  if (
    changes.name ||
    changes.city ||
    changes.document ||
    changes.email ||
    changes.phone ||
    changes.whatsapp ||
    changes.website
  ) {
    await ensureNoDuplicateLead(
      actor.ownerUserId,
      { ...current, ...changes } as CreateLeadInput,
      leadId,
    );
  }
  if (changes.referredByCompanyId)
    await ownedCompany(actor.ownerUserId, changes.referredByCompanyId);
  const now = new Date();
  const response = { id: leadId, updatedAt: now };
  return idempotentWrite({
    actor,
    idempotencyKey,
    operation: 'crm_update_lead',
    request: { leadId, ...input },
    response,
    audit: {
      entityType: 'companies',
      entityId: leadId,
      changes: {
        before: Object.fromEntries(
          Object.keys(changes).map((key) => [
            key,
            current[key as keyof typeof current],
          ]),
        ),
        after: changes,
      },
    },
    run: async (reserve) => {
      const updatedLead = db.$with('updated_lead').as(
        db
          .update(companies)
          .set({ ...changes, updatedAt: now })
          .where(
            and(
              eq(companies.id, leadId),
              eq(companies.ownerUserId, actor.ownerUserId),
              eq(companies.updatedAt, expectedUpdatedAt),
            ),
          )
          .returning({ id: companies.id }),
      );
      await db.batch([
        reserve,
        db
          .with(updatedLead)
          .select({ concurrencyGuard: versionGuard(updatedLead) })
          .from(sql`(select 1) as concurrency_guard_source`),
        activity({
          ownerUserId: actor.ownerUserId,
          companyId: leadId,
          entityType: 'companies',
          entityId: leadId,
          action: 'updated',
          description: 'Lead atualizado por agente autorizado.',
          metadata: { fields: Object.keys(changes), source: 'agent' },
        }),
      ]);
    },
  });
}

export async function setAgentLeadStage(
  actor: AgentWriteActor,
  idempotencyKey: string,
  leadId: string,
  input: SetLeadStageInput,
) {
  const prior = await completedReplay<{
    id: string;
    prospectingStatus: string;
    updatedAt: Date;
  }>({
    actor,
    idempotencyKey,
    operation: 'crm_set_lead_stage',
    request: { leadId, ...input },
  });
  if (prior) return prior;
  const current = await ownedCompany(actor.ownerUserId, leadId);
  assertExpected(current.updatedAt, input.expectedUpdatedAt);
  const now = new Date();
  const response = {
    id: leadId,
    prospectingStatus: input.prospectingStatus,
    updatedAt: now,
  };
  return idempotentWrite({
    actor,
    idempotencyKey,
    operation: 'crm_set_lead_stage',
    request: { leadId, ...input },
    response,
    audit: {
      entityType: 'companies',
      entityId: leadId,
      changes: {
        before: { prospectingStatus: current.prospectingStatus },
        after: {
          prospectingStatus: input.prospectingStatus,
          reason: input.reason,
        },
      },
    },
    run: async (reserve) => {
      const updatedLeadStage = db.$with('updated_lead_stage').as(
        db
          .update(companies)
          .set({
            prospectingStatus: input.prospectingStatus,
            ...(input.prospectingStatus === 'FECHADO'
              ? {
                  lifecycleStatus: 'client' as const,
                  relationshipStatus: 'active_non_recurring' as const,
                }
              : {}),
            updatedAt: now,
          })
          .where(
            and(
              eq(companies.id, leadId),
              eq(companies.ownerUserId, actor.ownerUserId),
              eq(companies.updatedAt, input.expectedUpdatedAt),
            ),
          )
          .returning({ id: companies.id }),
      );
      await db.batch([
        reserve,
        db
          .with(updatedLeadStage)
          .select({ concurrencyGuard: versionGuard(updatedLeadStage) })
          .from(sql`(select 1) as concurrency_guard_source`),
        activity({
          ownerUserId: actor.ownerUserId,
          companyId: leadId,
          entityType: 'companies',
          entityId: leadId,
          action: 'updated',
          description: `Etapa do lead alterada para ${input.prospectingStatus}.`,
          metadata: {
            previousProspectingStatus: current.prospectingStatus,
            prospectingStatus: input.prospectingStatus,
            reason: input.reason,
            source: 'agent',
          },
        }),
      ]);
    },
  });
}

export async function moveAgentOpportunity(
  actor: AgentWriteActor,
  idempotencyKey: string,
  opportunityId: string,
  input: MoveOpportunityInput,
) {
  const prior = await completedReplay<{
    id: string;
    pipelineStageId: string;
    stage: string;
    updatedAt: Date;
  }>({
    actor,
    idempotencyKey,
    operation: 'crm_move_opportunity',
    request: { opportunityId, ...input },
  });
  if (prior) return prior;
  const [[opportunity], [stage]] = await Promise.all([
    db
      .select()
      .from(opportunities)
      .where(
        and(
          eq(opportunities.id, opportunityId),
          eq(opportunities.ownerUserId, actor.ownerUserId),
          isNull(opportunities.archivedAt),
        ),
      )
      .limit(1),
    db
      .select()
      .from(pipelineStages)
      .where(
        and(
          eq(pipelineStages.id, input.pipelineStageId),
          eq(pipelineStages.ownerUserId, actor.ownerUserId),
          eq(pipelineStages.isActive, true),
        ),
      )
      .limit(1),
  ]);
  if (!opportunity)
    throw new AgentApiError(
      'AGENT_OPPORTUNITY_NOT_FOUND',
      'Oportunidade não encontrada.',
      404,
    );
  if (!stage)
    throw new AgentApiError(
      'AGENT_STAGE_NOT_FOUND',
      'Etapa comercial não encontrada.',
      404,
    );
  assertExpected(opportunity.updatedAt, input.expectedUpdatedAt);
  const transition = pipelineTransition({
    isWon: stage.isWon,
    isLost: stage.isLost,
    lostReason: input.lostReason,
  });
  const now = new Date();
  const response = {
    id: opportunityId,
    pipelineStageId: stage.id,
    stage: stage.slug,
    updatedAt: now,
  };
  return idempotentWrite({
    actor,
    idempotencyKey,
    operation: 'crm_move_opportunity',
    request: { opportunityId, ...input },
    response,
    audit: {
      entityType: 'opportunities',
      entityId: opportunityId,
      changes: {
        before: { pipelineStageId: opportunity.pipelineStageId },
        after: {
          pipelineStageId: stage.id,
          reason: input.reason,
          lostReason: input.lostReason,
        },
      },
    },
    run: async (reserve) => {
      const updatedOpportunity = db.$with('updated_opportunity').as(
        db
          .update(opportunities)
          .set({
            pipelineStageId: stage.id,
            wonAt: transition.wonAt,
            lostAt: transition.lostAt,
            lostReason: transition.lostReason,
            updatedAt: now,
          })
          .where(
            and(
              eq(opportunities.id, opportunityId),
              eq(opportunities.ownerUserId, actor.ownerUserId),
              eq(opportunities.updatedAt, input.expectedUpdatedAt),
            ),
          )
          .returning({ id: opportunities.id }),
      );
      const statements = [
        reserve,
        db
          .with(updatedOpportunity)
          .select({ concurrencyGuard: versionGuard(updatedOpportunity) })
          .from(sql`(select 1) as concurrency_guard_source`),
        db.insert(pipelineHistory).values({
          ownerUserId: actor.ownerUserId,
          companyId: opportunity.companyId,
          opportunityId,
          fromStageId: opportunity.pipelineStageId,
          toStageId: stage.id,
          reason: input.reason || input.lostReason,
          changedBy: actor.ownerUserId,
        }),
        activity({
          ownerUserId: actor.ownerUserId,
          companyId: opportunity.companyId,
          entityType: 'opportunity',
          entityId: opportunityId,
          action: stage.isWon ? 'won' : stage.isLost ? 'lost' : 'stage_changed',
          description: `Oportunidade movida para ${stage.name}.`,
          metadata: {
            stageId: stage.id,
            stage: stage.slug,
            reason: input.reason,
            source: 'agent',
          },
        }),
      ] as const;
      if (transition.companyLifecycle) {
        await db.batch([
          ...statements,
          db
            .update(companies)
            .set({
              lifecycleStatus: transition.companyLifecycle,
              relationshipStatus: 'active_non_recurring',
              updatedAt: now,
            })
            .where(
              and(
                eq(companies.id, opportunity.companyId),
                eq(companies.ownerUserId, actor.ownerUserId),
              ),
            ),
        ]);
      } else await db.batch(statements);
    },
  });
}

export async function createAgentInteraction(
  actor: AgentWriteActor,
  idempotencyKey: string,
  input: CreateInteractionInput,
) {
  const prior = await completedReplay<{
    id: string;
    followUpId: string | null;
    occurredAt: Date;
    updatedAt: Date;
  }>({
    actor,
    idempotencyKey,
    operation: 'crm_create_interaction',
    request: input,
  });
  if (prior) return prior;
  const company = await ownedCompany(actor.ownerUserId, input.companyId);
  const [ownerSettings] = await db
    .select({ recurringPostSaleDays: settings.recurringPostSaleDays })
    .from(settings)
    .where(eq(settings.ownerUserId, actor.ownerUserId))
    .limit(1);
  if (input.opportunityId) {
    const [opportunity] = await db
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(
        and(
          eq(opportunities.id, input.opportunityId),
          eq(opportunities.ownerUserId, actor.ownerUserId),
          eq(opportunities.companyId, input.companyId),
          isNull(opportunities.archivedAt),
        ),
      )
      .limit(1);
    if (!opportunity)
      throw new AgentApiError(
        'AGENT_OPPORTUNITY_NOT_FOUND',
        'Oportunidade vinculada não encontrada.',
        404,
      );
  }
  const id = randomUUID();
  const occurredAt = input.occurredAt || new Date();
  const now = new Date();
  const followUpId =
    input.nextAction && input.nextActionAt ? randomUUID() : null;
  const nextContactAt =
    company.lifecycleStatus === 'client'
      ? new Date(
          occurredAt.getTime() +
            (ownerSettings?.recurringPostSaleDays || 180) * 86_400_000,
        )
      : company.contactFrequencyMonths
        ? dateAtNoon(
            nextPostSaleDate(
              occurredAt.toISOString().slice(0, 10),
              company.contactFrequencyMonths,
            ),
          )
        : company.nextContactAt;
  const response = { id, followUpId, occurredAt, updatedAt: now };
  return idempotentWrite({
    actor,
    idempotencyKey,
    operation: 'crm_create_interaction',
    request: input,
    response,
    audit: {
      entityType: 'interactions',
      entityId: id,
      changes: { before: null, after: input },
    },
    run: async (reserve) => {
      const core = [
        reserve,
        db.insert(interactions).values({
          id,
          ownerUserId: actor.ownerUserId,
          companyId: input.companyId,
          opportunityId: input.opportunityId,
          type: input.type,
          subject: input.subject,
          content: input.content,
          result: input.result,
          notes: input.notes,
          occurredAt,
          createdBy: actor.ownerUserId,
          responsibleUserId: actor.ownerUserId,
          nextAction: input.nextAction,
          nextActionAt: input.nextActionAt,
          createdAt: now,
          updatedAt: now,
        }),
        db
          .update(companies)
          .set({
            lastContactAt: occurredAt,
            nextContactAt,
            nextAction: input.nextAction || company.nextAction,
            nextActionAt: input.nextActionAt || company.nextActionAt,
            updatedAt: now,
          })
          .where(
            and(
              eq(companies.id, input.companyId),
              eq(companies.ownerUserId, actor.ownerUserId),
            ),
          ),
        activity({
          ownerUserId: actor.ownerUserId,
          companyId: input.companyId,
          entityType: 'interactions',
          entityId: id,
          action: 'created',
          description: 'Contato registrado por agente autorizado.',
          metadata: { type: input.type, source: 'agent' },
        }),
      ] as const;
      if (followUpId && input.nextAction && input.nextActionAt) {
        await db.batch([
          ...core,
          db.insert(tasks).values({
            id: followUpId,
            ownerUserId: actor.ownerUserId,
            companyId: input.companyId,
            opportunityId: input.opportunityId,
            title: input.nextAction,
            type: 'follow_up',
            dueAt: input.nextActionAt,
            source: 'automation',
            responsibleUserId: actor.ownerUserId,
            idempotencyKey: `${hash(actor.actorKey).slice(0, 16)}:${idempotencyKey}:interaction-follow-up`,
          }),
        ]);
      } else await db.batch(core);
    },
  });
}

export async function setAgentInteractionResult(
  actor: AgentWriteActor,
  idempotencyKey: string,
  interactionId: string,
  input: SetInteractionResultInput,
) {
  const prior = await completedReplay<{
    id: string;
    followUpId: string | null;
    updatedAt: Date;
  }>({
    actor,
    idempotencyKey,
    operation: 'crm_set_interaction_result',
    request: { interactionId, ...input },
  });
  if (prior) return prior;
  const [current] = await db
    .select()
    .from(interactions)
    .where(
      and(
        eq(interactions.id, interactionId),
        eq(interactions.ownerUserId, actor.ownerUserId),
      ),
    )
    .limit(1);
  if (!current)
    throw new AgentApiError(
      'AGENT_INTERACTION_NOT_FOUND',
      'Contato não encontrado.',
      404,
    );
  assertExpected(current.updatedAt, input.expectedUpdatedAt);
  const now = new Date();
  const followUpId =
    input.nextAction && input.nextActionAt ? randomUUID() : null;
  const response = { id: interactionId, followUpId, updatedAt: now };
  const after = {
    result: input.result,
    notes: input.notes,
    nextAction: input.nextAction,
    nextActionAt: input.nextActionAt,
  };
  return idempotentWrite({
    actor,
    idempotencyKey,
    operation: 'crm_set_interaction_result',
    request: { interactionId, ...input },
    response,
    audit: {
      entityType: 'interactions',
      entityId: interactionId,
      changes: {
        before: {
          result: current.result,
          notes: current.notes,
          nextAction: current.nextAction,
          nextActionAt: current.nextActionAt,
        },
        after,
      },
    },
    run: async (reserve) => {
      const updatedInteraction = db.$with('updated_interaction').as(
        db
          .update(interactions)
          .set({ ...after, updatedAt: now })
          .where(
            and(
              eq(interactions.id, interactionId),
              eq(interactions.ownerUserId, actor.ownerUserId),
              eq(interactions.updatedAt, input.expectedUpdatedAt),
            ),
          )
          .returning({ id: interactions.id }),
      );
      const core = [
        reserve,
        db
          .with(updatedInteraction)
          .select({ concurrencyGuard: versionGuard(updatedInteraction) })
          .from(sql`(select 1) as concurrency_guard_source`),
        activity({
          ownerUserId: actor.ownerUserId,
          companyId: current.companyId,
          entityType: 'interactions',
          entityId: interactionId,
          action: 'updated',
          description: 'Resultado do contato registrado por agente autorizado.',
          metadata: { source: 'agent' },
        }),
      ] as const;
      if (followUpId && input.nextAction && input.nextActionAt) {
        await db.batch([
          ...core,
          db.insert(tasks).values({
            id: followUpId,
            ownerUserId: actor.ownerUserId,
            companyId: current.companyId,
            opportunityId: current.opportunityId,
            title: input.nextAction,
            type: 'follow_up',
            dueAt: input.nextActionAt,
            source: 'automation',
            responsibleUserId: actor.ownerUserId,
            idempotencyKey: `${hash(actor.actorKey).slice(0, 16)}:${idempotencyKey}:result-follow-up`,
          }),
        ]);
      } else await db.batch(core);
    },
  });
}

export async function createAgentFollowUp(
  actor: AgentWriteActor,
  idempotencyKey: string,
  input: CreateFollowUpInput,
) {
  const prior = await completedReplay<{
    id: string;
    dueAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }>({
    actor,
    idempotencyKey,
    operation: 'crm_create_follow_up',
    request: input,
  });
  if (prior) return prior;
  await ownedCompany(actor.ownerUserId, input.companyId);
  if (input.opportunityId) {
    const [opportunity] = await db
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(
        and(
          eq(opportunities.id, input.opportunityId),
          eq(opportunities.ownerUserId, actor.ownerUserId),
          eq(opportunities.companyId, input.companyId),
        ),
      )
      .limit(1);
    if (!opportunity)
      throw new AgentApiError(
        'AGENT_OPPORTUNITY_NOT_FOUND',
        'Oportunidade vinculada não encontrada.',
        404,
      );
  }
  const id = randomUUID();
  const now = new Date();
  const response = { id, dueAt: input.dueAt, createdAt: now, updatedAt: now };
  return idempotentWrite({
    actor,
    idempotencyKey,
    operation: 'crm_create_follow_up',
    request: input,
    response,
    audit: {
      entityType: 'tasks',
      entityId: id,
      changes: { before: null, after: input },
    },
    run: async (reserve) => {
      await db.batch([
        reserve,
        db.insert(tasks).values({
          id,
          ownerUserId: actor.ownerUserId,
          companyId: input.companyId,
          opportunityId: input.opportunityId,
          type: 'follow_up',
          title: input.title,
          description: input.description,
          reason: input.reason,
          priority: input.priority,
          dueAt: input.dueAt,
          reminderAt: input.reminderAt,
          source: 'automation',
          responsibleUserId: actor.ownerUserId,
          idempotencyKey: `${hash(actor.actorKey).slice(0, 16)}:${idempotencyKey}`,
          createdAt: now,
          updatedAt: now,
        }),
        db
          .update(companies)
          .set({
            nextAction: input.title,
            nextActionAt: input.dueAt,
            updatedAt: now,
          })
          .where(
            and(
              eq(companies.id, input.companyId),
              eq(companies.ownerUserId, actor.ownerUserId),
            ),
          ),
        activity({
          ownerUserId: actor.ownerUserId,
          companyId: input.companyId,
          entityType: 'tasks',
          entityId: id,
          action: 'created',
          description: 'Follow-up criado por agente autorizado.',
          metadata: { source: 'agent' },
        }),
      ]);
    },
  });
}

export async function createAgentReferral(
  actor: AgentWriteActor,
  idempotencyKey: string,
  input: CreateReferralInput,
) {
  const prior = await completedReplay<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
  }>({
    actor,
    idempotencyKey,
    operation: 'crm_create_referral',
    request: input,
  });
  if (prior) return prior;
  await Promise.all([
    ownedCompany(actor.ownerUserId, input.referrerCompanyId),
    ownedCompany(actor.ownerUserId, input.referredCompanyId),
  ]);
  const [duplicate] = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(
      and(
        eq(referrals.ownerUserId, actor.ownerUserId),
        eq(referrals.referrerCompanyId, input.referrerCompanyId),
        eq(referrals.referredCompanyId, input.referredCompanyId),
      ),
    )
    .limit(1);
  if (duplicate)
    throw new AgentApiError(
      'AGENT_DUPLICATE_REFERRAL',
      'Esta indicação já está registrada.',
      409,
      { referralId: duplicate.id },
    );
  const id = randomUUID();
  const now = new Date();
  const response = { id, createdAt: now, updatedAt: now };
  return idempotentWrite({
    actor,
    idempotencyKey,
    operation: 'crm_create_referral',
    request: input,
    response,
    audit: {
      entityType: 'referrals',
      entityId: id,
      changes: { before: null, after: input },
    },
    run: async (reserve) => {
      await db.batch([
        reserve,
        db.insert(referrals).values({
          id,
          ownerUserId: actor.ownerUserId,
          ...input,
          convertedAt: input.status === 'CONVERTIDO' ? now : null,
          createdAt: now,
          updatedAt: now,
        }),
        db
          .update(companies)
          .set({ referredByCompanyId: input.referrerCompanyId, updatedAt: now })
          .where(
            and(
              eq(companies.id, input.referredCompanyId),
              eq(companies.ownerUserId, actor.ownerUserId),
            ),
          ),
        activity({
          ownerUserId: actor.ownerUserId,
          companyId: input.referredCompanyId,
          entityType: 'referrals',
          entityId: id,
          action: 'created',
          description: 'Indicação registrada por agente autorizado.',
          metadata: {
            referrerCompanyId: input.referrerCompanyId,
            source: 'agent',
          },
        }),
      ]);
    },
  });
}

export async function upsertAgentDigitalAnalysis(
  actor: AgentWriteActor,
  idempotencyKey: string,
  leadId: string,
  input: UpsertAnalysisInput,
) {
  const prior = await completedReplay<{
    id: string;
    leadId: string;
    leadScore: number;
    scoreLevel: string;
    updatedAt: Date;
  }>({
    actor,
    idempotencyKey,
    operation: 'crm_upsert_digital_analysis',
    request: { leadId, ...input },
  });
  if (prior) return prior;
  const [company, [existing], customRules] = await Promise.all([
    ownedCompany(actor.ownerUserId, leadId),
    db
      .select()
      .from(digitalAnalyses)
      .where(
        and(
          eq(digitalAnalyses.ownerUserId, actor.ownerUserId),
          eq(digitalAnalyses.companyId, leadId),
        ),
      )
      .limit(1),
    db
      .select()
      .from(leadScoreRules)
      .where(eq(leadScoreRules.ownerUserId, actor.ownerUserId)),
  ]);
  if (existing && !input.expectedUpdatedAt) {
    throw new AgentApiError(
      'AGENT_VERSION_REQUIRED',
      'expectedUpdatedAt é obrigatório para atualizar uma análise existente.',
      409,
      { currentUpdatedAt: existing.updatedAt.toISOString() },
    );
  }
  if (existing && input.expectedUpdatedAt)
    assertExpected(existing.updatedAt, input.expectedUpdatedAt);
  const { expectedUpdatedAt, ...analysis } = input;
  const merged = { ...existing, ...analysis };
  const score =
    analysis.scoreOverride !== null && analysis.scoreOverride !== undefined
      ? {
          score: analysis.scoreOverride,
          level: leadScoreLevel(analysis.scoreOverride),
          breakdown: [
            {
              ruleKey: 'manual_override',
              label: 'Pontuação informada manualmente',
              points: analysis.scoreOverride,
            },
          ],
        }
      : calculateLeadScore(
          company,
          merged,
          customRules.length ? customRules : DEFAULT_LEAD_SCORE_RULES,
        );
  const id = existing?.id || randomUUID();
  const now = new Date();
  const values = {
    ...analysis,
    leadScore: score.score,
    scoreLevel: score.level,
    scoreBreakdown: score.breakdown,
    analyzedAt: now,
    updatedAt: now,
  };
  const response = {
    id,
    leadId,
    leadScore: score.score,
    scoreLevel: score.level,
    updatedAt: now,
  };
  return idempotentWrite({
    actor,
    idempotencyKey,
    operation: 'crm_upsert_digital_analysis',
    request: { leadId, ...input },
    response,
    audit: {
      entityType: 'digital_analyses',
      entityId: id,
      changes: { before: existing || null, after: values },
    },
    run: async (reserve) => {
      if (existing) {
        const updatedAnalysis = db.$with('updated_analysis').as(
          db
            .update(digitalAnalyses)
            .set(values)
            .where(
              and(
                eq(digitalAnalyses.id, id),
                eq(digitalAnalyses.ownerUserId, actor.ownerUserId),
                eq(digitalAnalyses.updatedAt, expectedUpdatedAt!),
              ),
            )
            .returning({ id: digitalAnalyses.id }),
        );
        await db.batch([
          reserve,
          db
            .with(updatedAnalysis)
            .select({ concurrencyGuard: versionGuard(updatedAnalysis) })
            .from(sql`(select 1) as concurrency_guard_source`),
          activity({
            ownerUserId: actor.ownerUserId,
            companyId: leadId,
            entityType: 'digitalAnalyses',
            entityId: id,
            action: 'updated',
            description: 'Análise digital atualizada por agente autorizado.',
            metadata: { leadScore: score.score, source: 'agent' },
          }),
        ]);
      } else {
        await db.batch([
          reserve,
          db.insert(digitalAnalyses).values({
            id,
            ownerUserId: actor.ownerUserId,
            companyId: leadId,
            ...values,
            createdAt: now,
          }),
          activity({
            ownerUserId: actor.ownerUserId,
            companyId: leadId,
            entityType: 'digitalAnalyses',
            entityId: id,
            action: 'created',
            description: 'Análise digital criada por agente autorizado.',
            metadata: { leadScore: score.score, source: 'agent' },
          }),
        ]);
      }
    },
  });
}

async function ownedProspectingBatch(ownerUserId: string, batchId: string) {
  const [batch] = await db
    .select()
    .from(prospectingBatches)
    .where(
      and(
        eq(prospectingBatches.id, batchId),
        eq(prospectingBatches.ownerUserId, ownerUserId),
      ),
    )
    .limit(1);
  if (!batch)
    throw new AgentApiError(
      'AGENT_PROSPECTING_BATCH_NOT_FOUND',
      'Lote de prospecção não encontrado.',
      404,
    );
  return batch;
}

async function ownedProspectingCandidate(
  ownerUserId: string,
  candidateId: string,
) {
  const [candidate] = await db
    .select()
    .from(prospectingCandidates)
    .where(
      and(
        eq(prospectingCandidates.id, candidateId),
        eq(prospectingCandidates.ownerUserId, ownerUserId),
      ),
    )
    .limit(1);
  if (!candidate)
    throw new AgentApiError(
      'AGENT_PROSPECTING_CANDIDATE_NOT_FOUND',
      'Candidato de prospecção não encontrado.',
      404,
    );
  return candidate;
}

function prospectingFingerprint(input: {
  companyName: string;
  city?: string | null;
  website?: string | null;
  evidence?: Array<{ url: string }>;
}) {
  return hash(
    JSON.stringify({
      name: input.companyName.trim().toLocaleLowerCase('pt-BR'),
      city: (input.city || '').trim().toLocaleLowerCase('pt-BR'),
      domain: normalizeDomainIdentity(input.website),
      evidence: (input.evidence || []).map((item) => item.url).sort(),
    }),
  );
}

export async function createAgentProspectingBatch(
  actor: AgentWriteActor,
  idempotencyKey: string,
  input: CreateProspectingBatchInput,
) {
  const id = randomUUID();
  const now = new Date();
  const response = { id, createdAt: now, updatedAt: now };
  return idempotentWrite({
    actor,
    idempotencyKey,
    operation: 'crm_create_prospecting_batch',
    request: input,
    response,
    audit: {
      entityType: 'prospecting_batches',
      entityId: id,
      changes: { before: null, after: input },
    },
    run: async (reserve) => {
      await db.batch([
        reserve,
        db.insert(prospectingBatches).values({
          id,
          ownerUserId: actor.ownerUserId,
          ...input,
          createdAt: now,
          updatedAt: now,
        }),
      ]);
    },
  });
}

export async function addAgentProspectingCandidate(
  actor: AgentWriteActor,
  idempotencyKey: string,
  input: AddProspectingCandidateInput,
) {
  const prior = await completedReplay<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
  }>({
    actor,
    idempotencyKey,
    operation: 'crm_add_prospecting_candidate',
    request: input,
  });
  if (prior) return prior;
  await ownedProspectingBatch(actor.ownerUserId, input.batchId);
  const fingerprint = prospectingFingerprint(input);
  const [duplicate] = await db
    .select({ id: prospectingCandidates.id })
    .from(prospectingCandidates)
    .where(
      and(
        eq(prospectingCandidates.batchId, input.batchId),
        eq(prospectingCandidates.sourceFingerprint, fingerprint),
      ),
    )
    .limit(1);
  if (duplicate)
    throw new AgentApiError(
      'AGENT_DUPLICATE_PROSPECTING_CANDIDATE',
      'Este candidato já existe no lote.',
      409,
      { candidateId: duplicate.id },
    );
  const id = randomUUID();
  const now = new Date();
  const response = { id, createdAt: now, updatedAt: now };
  return idempotentWrite({
    actor,
    idempotencyKey,
    operation: 'crm_add_prospecting_candidate',
    request: input,
    response,
    audit: {
      entityType: 'prospecting_candidates',
      entityId: id,
      changes: { before: null, after: input },
    },
    run: async (reserve) => {
      await db.batch([
        reserve,
        db.insert(prospectingCandidates).values({
          id,
          ownerUserId: actor.ownerUserId,
          ...input,
          sourceFingerprint: fingerprint,
          researchedAt: input.researchedAt || now,
          createdAt: now,
          updatedAt: now,
        }),
        db
          .update(prospectingBatches)
          .set({ status: 'review', updatedAt: now })
          .where(
            and(
              eq(prospectingBatches.id, input.batchId),
              eq(prospectingBatches.ownerUserId, actor.ownerUserId),
            ),
          ),
      ]);
    },
  });
}

export async function updateAgentProspectingCandidate(
  actor: AgentWriteActor,
  idempotencyKey: string,
  candidateId: string,
  input: UpdateProspectingCandidateInput,
) {
  const prior = await completedReplay<{ id: string; updatedAt: Date }>({
    actor,
    idempotencyKey,
    operation: 'crm_update_prospecting_candidate',
    request: { candidateId, ...input },
  });
  if (prior) return prior;
  const current = await ownedProspectingCandidate(
    actor.ownerUserId,
    candidateId,
  );
  assertExpected(current.updatedAt, input.expectedUpdatedAt);
  if (current.status === 'promoted')
    throw new AgentApiError(
      'AGENT_PROSPECTING_CANDIDATE_PROMOTED',
      'O candidato já foi promovido; atualize o lead correspondente.',
      409,
      { leadId: current.promotedCompanyId },
    );
  const { expectedUpdatedAt, ...changes } = input;
  const now = new Date();
  const response = { id: candidateId, updatedAt: now };
  return idempotentWrite({
    actor,
    idempotencyKey,
    operation: 'crm_update_prospecting_candidate',
    request: { candidateId, ...input },
    response,
    audit: {
      entityType: 'prospecting_candidates',
      entityId: candidateId,
      changes: { before: current, after: changes },
    },
    run: async (reserve) => {
      const updatedCandidate = db.$with('updated_prospecting_candidate').as(
        db
          .update(prospectingCandidates)
          .set({ ...changes, updatedAt: now })
          .where(
            and(
              eq(prospectingCandidates.id, candidateId),
              eq(prospectingCandidates.ownerUserId, actor.ownerUserId),
              eq(prospectingCandidates.updatedAt, expectedUpdatedAt),
            ),
          )
          .returning({ id: prospectingCandidates.id }),
      );
      await db.batch([
        reserve,
        db
          .with(updatedCandidate)
          .select({ concurrencyGuard: versionGuard(updatedCandidate) })
          .from(sql`(select 1) as concurrency_guard_source`),
      ]);
    },
  });
}

export async function promoteAgentProspectingCandidate(
  actor: AgentWriteActor,
  idempotencyKey: string,
  candidateId: string,
) {
  const request = { candidateId };
  const prior = await completedReplay<{ id: string; candidateId: string }>({
    actor,
    idempotencyKey,
    operation: 'crm_promote_prospecting_candidate',
    request,
  });
  if (prior) return prior;
  const candidate = await ownedProspectingCandidate(
    actor.ownerUserId,
    candidateId,
  );
  if (candidate.promotedCompanyId)
    return {
      data: { id: candidate.promotedCompanyId, candidateId },
      replayed: true,
      audit: {
        entityType: 'prospecting_candidates',
        entityId: candidateId,
        changes: { alreadyPromoted: true },
      },
    };
  await ensureNoDuplicateLead(actor.ownerUserId, {
    name: candidate.companyName,
    city: candidate.city,
    state: candidate.state,
    industry: candidate.industry,
    email: candidate.publicEmail,
    phone: candidate.publicPhone,
    whatsapp: candidate.publicPhone,
    website: candidate.website,
    instagram: candidate.instagram,
    lifecycleStatus: 'lead',
    relationshipStatus: 'inactive',
    prospectingStatus: 'NOVO_LEAD',
    leadSource: 'Lote de prospecção',
    sourceUrl: candidate.evidence[0]?.url || null,
  } as CreateLeadInput);
  const id = randomUUID();
  const analysisId = randomUUID();
  const now = new Date();
  const response = { id, candidateId };
  return idempotentWrite({
    actor,
    idempotencyKey,
    operation: 'crm_promote_prospecting_candidate',
    request,
    response,
    audit: {
      entityType: 'prospecting_candidates',
      entityId: candidateId,
      changes: {
        before: { status: candidate.status },
        after: { status: 'promoted', promotedCompanyId: id },
      },
    },
    run: async (reserve) => {
      await db.batch([
        reserve,
        db.insert(companies).values({
          id,
          ownerUserId: actor.ownerUserId,
          name: candidate.companyName,
          website: candidate.website,
          instagram: candidate.instagram,
          email: candidate.publicEmail,
          phone: candidate.publicPhone,
          whatsapp: candidate.publicPhone,
          city: candidate.city,
          state: candidate.state,
          industry: candidate.industry,
          lifecycleStatus: 'lead',
          relationshipStatus: 'inactive',
          prospectingStatus: 'NOVO_LEAD',
          leadSource: 'Lote de prospecção',
          sourceUrl: candidate.evidence[0]?.url || null,
          notesSummary: candidate.observations,
          createdAt: now,
          updatedAt: now,
        }),
        db.insert(digitalAnalyses).values({
          id: analysisId,
          ownerUserId: actor.ownerUserId,
          companyId: id,
          hasSite: candidate.hasSite,
          websiteUrl: candidate.website,
          siteStatus: candidate.siteStatus,
          leadScore: candidate.score,
          scoreOverride: candidate.score,
          scoreLevel: leadScoreLevel(candidate.score),
          priority: leadScoreLevel(candidate.score),
          scoreBreakdown: candidate.scoreReasons.map((reason) => ({
            ruleKey: 'prospecting_research',
            label: reason,
            points: 0,
          })),
          issues: candidate.digitalPresence,
          opportunities: candidate.observations,
          analyzedAt: candidate.researchedAt || now,
          createdAt: now,
          updatedAt: now,
        }),
        db
          .update(prospectingCandidates)
          .set({ status: 'promoted', promotedCompanyId: id, updatedAt: now })
          .where(
            and(
              eq(prospectingCandidates.id, candidateId),
              eq(prospectingCandidates.ownerUserId, actor.ownerUserId),
            ),
          ),
        activity({
          ownerUserId: actor.ownerUserId,
          companyId: id,
          entityType: 'prospecting_candidates',
          entityId: candidateId,
          action: 'promoted',
          description: 'Candidato promovido para lead por agente autorizado.',
          metadata: { batchId: candidate.batchId, analysisId, source: 'agent' },
        }),
      ]);
    },
  });
}
