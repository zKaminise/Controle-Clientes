import { createHash, randomUUID } from 'node:crypto';
import { and, eq, inArray, like } from 'drizzle-orm';
import { db } from '@/db';
import {
  activities,
  agentIdempotencyKeys,
  companies,
  digitalAnalyses,
  interactions,
  opportunities,
  pipelineHistory,
  pipelineStages,
  referrals,
  tasks,
  users,
} from '@/db/schema';
import { AgentApiError, allowedAgentAdminEmail } from '@/lib/agent-auth';
import {
  createAgentFollowUp,
  createAgentInteraction,
  createAgentLead,
  createAgentReferral,
  moveAgentOpportunity,
  setAgentInteractionResult,
  setAgentLeadStage,
  updateAgentLead,
  upsertAgentDigitalAnalysis,
} from '@/lib/agent-write-service';

const runId = randomUUID();
const prefix = `QA MCP ${runId}`;
const actorKey = `smoke:${runId}`;
const actorHash = createHash('sha256').update(actorKey).digest('hex');
const createdCompanyIds: string[] = [];
let opportunityId: string | null = null;

const [owner] = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.email, allowedAgentAdminEmail()))
  .limit(1);
if (!owner) throw new Error('Administrador autorizado não encontrado.');
const actor = { ownerUserId: owner.id, actorKey };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function cleanup() {
  const rows = await db
    .select({ id: companies.id })
    .from(companies)
    .where(
      and(
        eq(companies.ownerUserId, owner.id),
        like(companies.name, `${prefix}%`),
      ),
    );
  const companyIds = [...new Set([...createdCompanyIds, ...rows.map((row) => row.id)])];
  if (companyIds.length) {
    await db.delete(referrals).where(
      and(
        eq(referrals.ownerUserId, owner.id),
        inArray(referrals.referredCompanyId, companyIds),
      ),
    );
    await db.delete(tasks).where(
      and(eq(tasks.ownerUserId, owner.id), inArray(tasks.companyId, companyIds)),
    );
    await db.delete(interactions).where(
      and(eq(interactions.ownerUserId, owner.id), inArray(interactions.companyId, companyIds)),
    );
    await db.delete(digitalAnalyses).where(
      and(eq(digitalAnalyses.ownerUserId, owner.id), inArray(digitalAnalyses.companyId, companyIds)),
    );
    if (opportunityId) {
      await db.delete(pipelineHistory).where(eq(pipelineHistory.opportunityId, opportunityId));
    }
    await db.delete(opportunities).where(
      and(eq(opportunities.ownerUserId, owner.id), inArray(opportunities.companyId, companyIds)),
    );
    await db.delete(activities).where(
      and(eq(activities.ownerUserId, owner.id), inArray(activities.companyId, companyIds)),
    );
    await db.delete(companies).where(
      and(eq(companies.ownerUserId, owner.id), inArray(companies.id, companyIds)),
    );
  }
  await db.delete(agentIdempotencyKeys).where(
    and(
      eq(agentIdempotencyKeys.ownerUserId, owner.id),
      eq(agentIdempotencyKeys.actorKey, actorHash),
    ),
  );
}

try {
  const leadAInput = {
    name: `${prefix} A`,
    city: 'São Paulo',
    state: 'SP',
    email: `qa-${runId}@example.com`,
    prospectingStatus: 'NOVO_LEAD' as const,
  };
  const leadA = await createAgentLead(actor, `${runId}:lead-a`, leadAInput);
  createdCompanyIds.push(leadA.data.id);
  const replay = await createAgentLead(actor, `${runId}:lead-a`, leadAInput);
  assert(replay.replayed && replay.data.id === leadA.data.id, 'Replay de lead falhou.');

  let conflict = false;
  try {
    await createAgentLead(actor, `${runId}:lead-a`, { ...leadAInput, name: `${prefix} diferente` });
  } catch (error) {
    conflict = error instanceof AgentApiError && error.code === 'AGENT_IDEMPOTENCY_CONFLICT';
  }
  assert(conflict, 'Reuso de chave com payload diferente não foi bloqueado.');

  const leadB = await createAgentLead(actor, `${runId}:lead-b`, {
    name: `${prefix} B`,
    city: 'Campinas',
    state: 'SP',
  });
  createdCompanyIds.push(leadB.data.id);

  const updated = await updateAgentLead(actor, `${runId}:update`, leadA.data.id, {
    expectedUpdatedAt: leadA.data.updatedAt,
    industry: 'Tecnologia',
  });
  let staleBlocked = false;
  try {
    await updateAgentLead(actor, `${runId}:stale`, leadA.data.id, {
      expectedUpdatedAt: leadA.data.updatedAt,
      industry: 'Valor obsoleto',
    });
  } catch (error) {
    staleBlocked = error instanceof AgentApiError && error.code === 'AGENT_VERSION_CONFLICT';
  }
  assert(staleBlocked, 'Concorrência otimista não bloqueou versão obsoleta.');

  const staged = await setAgentLeadStage(actor, `${runId}:stage`, leadA.data.id, {
    expectedUpdatedAt: updated.data.updatedAt,
    prospectingStatus: 'INTERESSADO',
    reason: 'Teste controlado',
  });
  assert(staged.data.prospectingStatus === 'INTERESSADO', 'Etapa do lead não foi alterada.');

  const concurrentWrites = await Promise.allSettled([
    updateAgentLead(actor, `${runId}:concurrent-a`, leadA.data.id, {
      expectedUpdatedAt: staged.data.updatedAt,
      notesSummary: 'Concorrência A',
    }),
    updateAgentLead(actor, `${runId}:concurrent-b`, leadA.data.id, {
      expectedUpdatedAt: staged.data.updatedAt,
      notesSummary: 'Concorrência B',
    }),
  ]);
  const fulfilledConcurrent = concurrentWrites.filter((item) => item.status === 'fulfilled');
  const rejectedConcurrent = concurrentWrites.filter((item) => item.status === 'rejected');
  assert(fulfilledConcurrent.length === 1, 'Exatamente uma escrita concorrente deve vencer.');
  assert(
    rejectedConcurrent.length === 1 &&
      rejectedConcurrent[0].reason instanceof AgentApiError &&
      rejectedConcurrent[0].reason.code === 'AGENT_VERSION_CONFLICT',
    'A escrita concorrente perdedora deve abortar com conflito de versão.',
  );

  const stages = await db
    .select()
    .from(pipelineStages)
    .where(and(eq(pipelineStages.ownerUserId, owner.id), eq(pipelineStages.isActive, true)))
    .orderBy(pipelineStages.position)
    .limit(2);
  assert(stages.length >= 2, 'Pipeline precisa ter ao menos duas etapas ativas.');
  opportunityId = randomUUID();
  const opportunityCreatedAt = new Date();
  await db.insert(opportunities).values({
    id: opportunityId,
    ownerUserId: owner.id,
    companyId: leadA.data.id,
    pipelineStageId: stages[0].id,
    title: `${prefix} oportunidade`,
    createdAt: opportunityCreatedAt,
    updatedAt: opportunityCreatedAt,
  });
  const moved = await moveAgentOpportunity(actor, `${runId}:move`, opportunityId, {
    expectedUpdatedAt: opportunityCreatedAt,
    pipelineStageId: stages[1].id,
    reason: 'Teste controlado',
    lostReason: null,
  });
  assert(moved.data.pipelineStageId === stages[1].id, 'Oportunidade não foi movida.');

  const interaction = await createAgentInteraction(actor, `${runId}:interaction`, {
    companyId: leadA.data.id,
    opportunityId,
    type: 'whatsapp',
    content: 'Contato de QA controlado.',
    nextAction: 'Retornar contato de QA',
    nextActionAt: new Date(Date.now() + 86_400_000),
  });
  const interactionResult = await setAgentInteractionResult(
    actor,
    `${runId}:interaction-result`,
    interaction.data.id,
    {
      expectedUpdatedAt: interaction.data.updatedAt,
      result: 'Cliente respondeu no teste.',
      nextAction: 'Enviar resumo de QA',
      nextActionAt: new Date(Date.now() + 172_800_000),
    },
  );
  assert(interactionResult.data.id === interaction.data.id, 'Resultado do contato falhou.');

  const followUp = await createAgentFollowUp(actor, `${runId}:follow-up`, {
    companyId: leadA.data.id,
    opportunityId,
    title: 'Follow-up independente de QA',
    priority: 'high',
    dueAt: new Date(Date.now() + 259_200_000),
  });
  assert(followUp.data.id, 'Follow-up não foi criado.');

  const referral = await createAgentReferral(actor, `${runId}:referral`, {
    referrerCompanyId: leadA.data.id,
    referredCompanyId: leadB.data.id,
    status: 'PENDENTE',
  });
  assert(referral.data.id, 'Indicação não foi criada.');

  const analysis = await upsertAgentDigitalAnalysis(actor, `${runId}:analysis`, leadA.data.id, {
    hasSite: false,
    siteStatus: 'SEM_SITE',
    hasActiveDigitalPresence: true,
  });
  assert(analysis.data.leadScore >= 0, 'Análise/score não foi calculada.');

  console.log(
    JSON.stringify(
      {
        ok: true,
        tests: {
          createLead: true,
          idempotentReplay: true,
          idempotencyConflict: true,
          updateLead: true,
          optimisticConcurrency: true,
          simultaneousConcurrency: true,
          setLeadStage: true,
          moveOpportunity: true,
          createInteraction: true,
          setInteractionResult: true,
          createFollowUp: true,
          createReferral: true,
          upsertDigitalAnalysis: true,
        },
      },
      null,
      2,
    ),
  );
} finally {
  await cleanup();
}
