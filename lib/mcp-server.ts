import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  getAgentAttention,
  getAgentCommercialMetrics,
  getAgentFollowUps,
  getAgentLead,
  getAgentLeadScore,
  getAgentLeadStage,
  getAgentOpportunityStage,
  searchAgentLeads,
} from '@/lib/agent-read-service';
import {
  agentAttentionQuerySchema,
  agentFollowUpQuerySchema,
  agentLeadSearchSchema,
  agentMetricsQuerySchema,
} from '@/lib/agent-validation';
import type { McpReadScope } from '@/lib/mcp-config';
import type { McpWriteScope } from '@/lib/mcp-config';
import {
  hasMcpScope,
  type McpPrincipal,
  withMcpToolAudit,
} from '@/lib/mcp-security';
import {
  agentCreateFollowUpSchema,
  agentCreateInteractionSchema,
  agentCreateLeadSchema,
  agentCreateReferralSchema,
  agentIdempotencyKeySchema,
  agentMoveOpportunitySchema,
  agentSetInteractionResultSchema,
  agentSetLeadStageSchema,
  agentUpdateLeadSchema,
  agentUpsertDigitalAnalysisSchema,
} from '@/lib/agent-write-validation';
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
  type AgentWriteResult,
} from '@/lib/agent-write-service';

const uuid = z.string().uuid();
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function jsonValue(value: unknown): z.infer<ReturnType<typeof z.json>> {
  return JSON.parse(JSON.stringify(value));
}

function result(data: unknown) {
  const normalized = jsonValue(data);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(normalized) }],
    structuredContent: { data: normalized },
  };
}

function registerReadTool<T extends z.ZodType>(
  server: McpServer,
  principal: McpPrincipal,
  definition: {
    name: string;
    title: string;
    description: string;
    scope: McpReadScope;
    inputSchema: T;
    run: (input: z.infer<T>) => Promise<unknown>;
  },
) {
  if (!hasMcpScope(principal, definition.scope)) return;
  // The SDK v2 declaration currently reverses its public input/output generics;
  // keep this narrow adapter until the upstream declaration is corrected.
  const registerTool = server.registerTool.bind(server) as unknown as (
    name: string,
    config: {
      title: string;
      description: string;
      inputSchema: z.ZodType;
      outputSchema: z.ZodType;
      annotations: {
        readOnlyHint: boolean;
        destructiveHint: boolean;
        idempotentHint: boolean;
        openWorldHint: boolean;
      };
    },
    callback: (input: unknown, context: unknown) => Promise<ReturnType<typeof result>>,
  ) => unknown;
  registerTool(
    definition.name,
    {
      title: definition.title,
      description: definition.description,
      inputSchema: definition.inputSchema,
      outputSchema: z.object({ data: z.json() }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input: unknown, context) => {
      void context;
      return result(
        await withMcpToolAudit(principal, definition.name, definition.scope, () =>
          definition.run(definition.inputSchema.parse(input)),
        ),
      );
    },
  );
}

function registerWriteTool<T extends z.ZodType>(
  server: McpServer,
  principal: McpPrincipal,
  definition: {
    name: string;
    title: string;
    description: string;
    scope: McpWriteScope;
    inputSchema: T;
    run: (input: z.infer<T>) => Promise<AgentWriteResult<unknown>>;
  },
) {
  if (!hasMcpScope(principal, definition.scope)) return;
  const registerTool = server.registerTool.bind(server) as unknown as (
    name: string,
    config: {
      title: string;
      description: string;
      inputSchema: z.ZodType;
      outputSchema: z.ZodType;
      annotations: {
        readOnlyHint: boolean;
        destructiveHint: boolean;
        idempotentHint: boolean;
        openWorldHint: boolean;
      };
    },
    callback: (input: unknown, context: unknown) => Promise<ReturnType<typeof result>>,
  ) => unknown;
  let completed: AgentWriteResult<unknown> | undefined;
  registerTool(
    definition.name,
    {
      title: definition.title,
      description: definition.description,
      inputSchema: definition.inputSchema,
      outputSchema: z.object({ data: z.json() }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input: unknown, context) => {
      void context;
      const parsed = definition.inputSchema.parse(input);
      completed = await withMcpToolAudit(
        principal,
        definition.name,
        definition.scope,
        () => definition.run(parsed),
        (value) => value?.audit || completed?.audit || {},
      );
      return result({ result: completed.data, idempotentReplay: completed.replayed });
    },
  );
}

export function createCrmMcpServer(principal: McpPrincipal) {
  const server = new McpServer({
    name: 'controle-clientes-crm',
    version: '3.0.0',
  });

  registerReadTool(server, principal, {
    name: 'crm_search_leads',
    title: 'Pesquisar leads',
    description: 'Pesquisa empresas e leads do CRM com filtros e paginação.',
    scope: 'crm:leads:read',
    inputSchema: z.object({
      query: z.string().trim().min(1).max(200).optional(),
      industry: z.string().trim().min(1).max(255).optional(),
      city: z.string().trim().min(1).max(255).optional(),
      state: z.string().trim().length(2).transform((value) => value.toUpperCase()).optional(),
      lifecycleStatus: z.enum(['lead', 'prospect', 'client', 'former_client', 'partner']).optional(),
      prospectingStatus: z.enum([
        'NOVO_LEAD', 'PESQUISANDO', 'PRONTO_PARA_CONTATO', 'CONTATO_WHATSAPP',
        'CONTATO_EMAIL', 'CONTATO_TELEFONE', 'SEM_RESPOSTA', 'RESPONDEU',
        'INTERESSADO', 'REUNIAO_AGENDADA', 'REUNIAO_REALIZADA', 'PROPOSTA_ENVIADA',
        'NEGOCIACAO', 'FOLLOWUP_FUTURO', 'FECHADO', 'PERDIDO', 'DESCARTADO',
        'NUMERO_INVALIDO', 'EMAIL_INVALIDO', 'JA_POSSUI_FORNECEDOR', 'SEM_INTERESSE',
      ]).optional(),
      siteStatus: z.enum(['SEM_SITE', 'SITE_RUIM', 'SITE_DEFASADO', 'SITE_MEDIANO', 'SITE_BOM', 'NAO_ANALISADO']).optional(),
      priority: z.enum(['BAIXA', 'MEDIA', 'ALTA', 'MUITO_ALTA']).optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(25),
    }).strict(),
    run: (input) => searchAgentLeads(principal.ownerUserId, agentLeadSearchSchema.parse(input)),
  });

  registerReadTool(server, principal, {
    name: 'crm_get_lead',
    title: 'Consultar lead',
    description: 'Retorna o cadastro, análise, contatos recentes, follow-ups, oportunidades e indicações do lead.',
    scope: 'crm:leads:read',
    inputSchema: z.object({ leadId: uuid }).strict(),
    run: ({ leadId }) => getAgentLead(principal.ownerUserId, leadId),
  });

  registerReadTool(server, principal, {
    name: 'crm_get_lead_stage',
    title: 'Consultar etapa do lead',
    description: 'Consulta a etapa de prospecção atual de um lead.',
    scope: 'crm:leads:read',
    inputSchema: z.object({ leadId: uuid }).strict(),
    run: ({ leadId }) => getAgentLeadStage(principal.ownerUserId, leadId),
  });

  registerReadTool(server, principal, {
    name: 'crm_get_opportunity_stage',
    title: 'Consultar etapa da oportunidade',
    description: 'Consulta a etapa atual de uma oportunidade no pipeline.',
    scope: 'crm:pipeline:read',
    inputSchema: z.object({ opportunityId: uuid }).strict(),
    run: ({ opportunityId }) => getAgentOpportunityStage(principal.ownerUserId, opportunityId),
  });

  registerReadTool(server, principal, {
    name: 'crm_get_follow_ups',
    title: 'Consultar follow-ups',
    description: 'Lista follow-ups atrasados, de hoje, próximos ou leads sem próxima ação.',
    scope: 'crm:followups:read',
    inputSchema: z.object({
      bucket: z.enum(['overdue', 'today', 'upcoming', 'without_action']).optional(),
      limit: z.number().int().min(1).max(100).default(50),
    }).strict(),
    run: (input) => getAgentFollowUps(principal.ownerUserId, agentFollowUpQuerySchema.parse(input)),
  });

  registerReadTool(server, principal, {
    name: 'crm_get_lead_score',
    title: 'Consultar lead score',
    description: 'Retorna pontuação, prioridade e detalhamento do lead score.',
    scope: 'crm:analysis:read',
    inputSchema: z.object({ leadId: uuid }).strict(),
    run: ({ leadId }) => getAgentLeadScore(principal.ownerUserId, leadId),
  });

  registerReadTool(server, principal, {
    name: 'crm_get_attention',
    title: 'Consultar Minha Atenção',
    description: 'Lista tarefas e eventos priorizados que exigem atenção.',
    scope: 'crm:followups:read',
    inputSchema: z.object({
      type: z.enum(['task', 'charge', 'domain', 'meeting', 'lead_without_action']).optional(),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
      from: dateOnly.optional(),
      to: dateOnly.optional(),
      limit: z.number().int().min(1).max(100).default(50),
    }).strict(),
    run: (input) => getAgentAttention(principal.ownerUserId, agentAttentionQuerySchema.parse(input)),
  });

  registerReadTool(server, principal, {
    name: 'crm_get_commercial_metrics',
    title: 'Consultar métricas comerciais',
    description: 'Retorna métricas comerciais por período e comparação opcional com o período anterior.',
    scope: 'crm:metrics:read',
    inputSchema: z.object({
      from: dateOnly.optional(),
      to: dateOnly.optional(),
      comparePrevious: z.boolean().default(false),
    }).strict(),
    run: (input) => getAgentCommercialMetrics(principal.ownerUserId, agentMetricsQuerySchema.parse({
      ...input,
      comparePrevious: String(input.comparePrevious),
    })),
  });

  const actor = { ownerUserId: principal.ownerUserId, actorKey: `oauth:${principal.clientId}` };

  registerWriteTool(server, principal, {
    name: 'crm_create_lead',
    title: 'Cadastrar lead',
    description: 'Cadastra um lead após validar duplicidade. Exige uma chave idempotente única.',
    scope: 'crm:leads:write',
    inputSchema: z.object({ idempotencyKey: agentIdempotencyKeySchema, lead: agentCreateLeadSchema }).strict(),
    run: ({ idempotencyKey, lead }) => createAgentLead(actor, idempotencyKey, lead),
  });

  registerWriteTool(server, principal, {
    name: 'crm_update_lead',
    title: 'Atualizar lead',
    description: 'Atualiza campos permitidos de um lead com controle otimista por expectedUpdatedAt.',
    scope: 'crm:leads:write',
    inputSchema: z.object({ idempotencyKey: agentIdempotencyKeySchema, leadId: uuid, patch: agentUpdateLeadSchema }).strict(),
    run: ({ idempotencyKey, leadId, patch }) => updateAgentLead(actor, idempotencyKey, leadId, patch),
  });

  registerWriteTool(server, principal, {
    name: 'crm_set_lead_stage',
    title: 'Alterar etapa comercial do lead',
    description: 'Altera a etapa de prospecção do lead com controle de concorrência.',
    scope: 'crm:leads:write',
    inputSchema: z.object({ idempotencyKey: agentIdempotencyKeySchema, leadId: uuid, change: agentSetLeadStageSchema }).strict(),
    run: ({ idempotencyKey, leadId, change }) => setAgentLeadStage(actor, idempotencyKey, leadId, change),
  });

  registerWriteTool(server, principal, {
    name: 'crm_move_opportunity',
    title: 'Mover oportunidade',
    description: 'Move uma oportunidade para uma etapa válida e registra o histórico do pipeline.',
    scope: 'crm:pipeline:write',
    inputSchema: z.object({ idempotencyKey: agentIdempotencyKeySchema, opportunityId: uuid, change: agentMoveOpportunitySchema }).strict(),
    run: ({ idempotencyKey, opportunityId, change }) => moveAgentOpportunity(actor, idempotencyKey, opportunityId, change),
  });

  registerWriteTool(server, principal, {
    name: 'crm_create_interaction',
    title: 'Registrar contato',
    description: 'Registra contato com o lead e cria follow-up atômico quando houver próxima ação.',
    scope: 'crm:interactions:write',
    inputSchema: z.object({ idempotencyKey: agentIdempotencyKeySchema, interaction: agentCreateInteractionSchema }).strict(),
    run: ({ idempotencyKey, interaction }) => createAgentInteraction(actor, idempotencyKey, interaction),
  });

  registerWriteTool(server, principal, {
    name: 'crm_set_interaction_result',
    title: 'Registrar resultado do contato',
    description: 'Atualiza o resultado de um contato e pode criar o próximo follow-up.',
    scope: 'crm:interactions:write',
    inputSchema: z.object({ idempotencyKey: agentIdempotencyKeySchema, interactionId: uuid, result: agentSetInteractionResultSchema }).strict(),
    run: ({ idempotencyKey, interactionId, result: interactionResult }) =>
      setAgentInteractionResult(actor, idempotencyKey, interactionId, interactionResult),
  });

  registerWriteTool(server, principal, {
    name: 'crm_create_follow_up',
    title: 'Criar follow-up',
    description: 'Cria um follow-up para um lead e atualiza sua próxima ação.',
    scope: 'crm:followups:write',
    inputSchema: z.object({ idempotencyKey: agentIdempotencyKeySchema, followUp: agentCreateFollowUpSchema }).strict(),
    run: ({ idempotencyKey, followUp }) => createAgentFollowUp(actor, idempotencyKey, followUp),
  });

  registerWriteTool(server, principal, {
    name: 'crm_create_referral',
    title: 'Registrar indicação',
    description: 'Registra uma indicação entre duas empresas existentes e distintas.',
    scope: 'crm:referrals:write',
    inputSchema: z.object({ idempotencyKey: agentIdempotencyKeySchema, referral: agentCreateReferralSchema }).strict(),
    run: ({ idempotencyKey, referral }) => createAgentReferral(actor, idempotencyKey, referral),
  });

  registerWriteTool(server, principal, {
    name: 'crm_upsert_digital_analysis',
    title: 'Criar ou atualizar análise digital',
    description: 'Cria ou atualiza a análise digital e recalcula o lead score pelas regras do CRM.',
    scope: 'crm:analysis:write',
    inputSchema: z.object({ idempotencyKey: agentIdempotencyKeySchema, leadId: uuid, analysis: agentUpsertDigitalAnalysisSchema }).strict(),
    run: ({ idempotencyKey, leadId, analysis }) => upsertAgentDigitalAnalysis(actor, idempotencyKey, leadId, analysis),
  });

  return server;
}
