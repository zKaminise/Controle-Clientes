import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { APP_TIMEZONE, isoDateInTimeZone } from '@/lib/business';

const successEnvelope = z.object({
  data: z.unknown(),
  meta: z.object({ requestId: z.string().uuid() }),
});

type Check = {
  endpoint: string;
  status: number;
  requestId: string;
  summary: Record<string, unknown>;
};

function assertNoAdministrativeData(data: unknown) {
  const serialized = JSON.stringify(data);
  for (const key of [
    'ownerUserId',
    'password',
    'sessionToken',
    'tokenHash',
    'DATABASE_URL',
  ]) {
    if (serialized.includes(`"${key}"`))
      throw new Error(`A resposta expôs o campo administrativo ${key}.`);
  }
}

export async function runAgentApiConsumer(input: {
  baseUrl: string;
  token: string;
}) {
  const base = input.baseUrl.replace(/\/$/, '');
  const parsedBase = new URL(base);
  if (
    parsedBase.protocol !== 'https:' &&
    !['localhost', '127.0.0.1'].includes(parsedBase.hostname)
  )
    throw new Error(
      'AGENT_API_BASE_URL deve usar HTTPS fora do ambiente local.',
    );
  if (input.token.length < 24)
    throw new Error('AGENT_API_TOKEN ausente ou inválido.');

  const checks: Check[] = [];
  async function get(endpoint: string) {
    const response = await fetch(`${base}${endpoint}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.token}`,
      },
      cache: 'no-store',
    });
    const body: unknown = await response.json();
    if (response.status !== 200) {
      const code = z
        .object({ error: z.object({ code: z.string() }) })
        .safeParse(body);
      throw new Error(
        `${endpoint} retornou HTTP ${response.status} (${code.success ? code.data.error.code : 'erro desconhecido'}).`,
      );
    }
    const envelope = successEnvelope.parse(body);
    const headerRequestId = response.headers.get('x-request-id');
    if (headerRequestId !== envelope.meta.requestId)
      throw new Error(`${endpoint} retornou requestId inconsistente.`);
    assertNoAdministrativeData(envelope.data);
    return { data: envelope.data, requestId: envelope.meta.requestId };
  }

  const leadsResult = await get('/leads?page=1&pageSize=5');
  const leads = z
    .object({
      items: z.array(z.object({ id: z.string().uuid() }).passthrough()),
      pagination: z.object({
        page: z.number(),
        pageSize: z.number(),
        total: z.number(),
        pages: z.number(),
      }),
    })
    .parse(leadsResult.data);
  if (!leads.items[0])
    throw new Error(
      'A consulta não retornou um lead real para validar o fluxo.',
    );
  checks.push({
    endpoint: 'GET /leads',
    status: 200,
    requestId: leadsResult.requestId,
    summary: {
      returned: leads.items.length,
      total: leads.pagination.total,
      page: leads.pagination.page,
      pageSize: leads.pagination.pageSize,
    },
  });

  const leadId = leads.items[0].id;
  const detailResult = await get(`/leads/${leadId}`);
  const detail = z
    .object({ company: z.object({ id: z.string().uuid() }).passthrough() })
    .passthrough()
    .parse(detailResult.data);
  if (detail.company.id !== leadId)
    throw new Error('O detalhe retornado não corresponde ao lead solicitado.');
  checks.push({
    endpoint: 'GET /leads/:id',
    status: 200,
    requestId: detailResult.requestId,
    summary: { matchingLead: true },
  });

  const stageResult = await get(`/leads/${leadId}/stage`);
  const stage = z
    .object({
      leadId: z.string().uuid(),
      prospectingStatus: z.string(),
    })
    .passthrough()
    .parse(stageResult.data);
  checks.push({
    endpoint: 'GET /leads/:id/stage',
    status: 200,
    requestId: stageResult.requestId,
    summary: {
      matchingLead: stage.leadId === leadId,
      field: 'company.prospectingStatus',
      hasProspectingStatus: Boolean(stage.prospectingStatus),
    },
  });

  const scoreResult = await get(`/leads/${leadId}/score`);
  const score = z
    .object({
      leadScore: z.number().nullable(),
      scoreLevel: z.string().nullable(),
      priority: z.string().nullable(),
      scoreBreakdown: z.unknown().nullable(),
      analyzedAt: z.coerce.date().nullable(),
    })
    .passthrough()
    .parse(scoreResult.data);
  checks.push({
    endpoint: 'GET /leads/:id/score',
    status: 200,
    requestId: scoreResult.requestId,
    summary: {
      analysisAvailable: score.analyzedAt !== null,
      nullableContractValid: true,
    },
  });

  const followUpResult = await get('/follow-ups?limit=10');
  const followUps = z
    .object({
      timezone: z.literal(APP_TIMEZONE),
      overdue: z.array(z.unknown()),
      today: z.array(z.unknown()),
      upcoming: z.array(z.unknown()),
      leadsWithoutAction: z.array(z.unknown()),
    })
    .passthrough()
    .parse(followUpResult.data);
  checks.push({
    endpoint: 'GET /follow-ups',
    status: 200,
    requestId: followUpResult.requestId,
    summary: {
      timezone: followUps.timezone,
      overdue: followUps.overdue.length,
      today: followUps.today.length,
      upcoming: followUps.upcoming.length,
      leadsWithoutAction: followUps.leadsWithoutAction.length,
    },
  });

  const attentionResult = await get('/attention?limit=10');
  const attention = z
    .object({
      timezone: z.literal(APP_TIMEZONE),
      items: z.array(z.object({ type: z.string() }).passthrough()),
    })
    .passthrough()
    .parse(attentionResult.data);
  const filteredAttentionResult = await get(
    '/attention?type=lead_without_action&priority=normal&limit=5',
  );
  const filteredAttention = z
    .object({
      items: z.array(z.object({ type: z.literal('lead_without_action') })),
    })
    .passthrough()
    .parse(filteredAttentionResult.data);
  checks.push({
    endpoint: 'GET /attention',
    status: 200,
    requestId: attentionResult.requestId,
    summary: {
      timezone: attention.timezone,
      items: attention.items.length,
      filterValidated: filteredAttention.items.every(
        (item) => item.type === 'lead_without_action',
      ),
    },
  });

  const today = isoDateInTimeZone(new Date(), APP_TIMEZONE);
  const from = `${today.slice(0, 8)}01`;
  const metricsResult = await get(
    `/metrics/commercial?from=${from}&to=${today}&timezone=${APP_TIMEZONE}&comparePrevious=true`,
  );
  const metrics = z
    .object({
      period: z.object({
        from: z.literal(from),
        to: z.literal(today),
        timezone: z.literal(APP_TIMEZONE),
      }),
      metrics: z.object({
        newLeads: z.number(),
        contacts: z.number(),
        noResponse: z.number(),
        interested: z.number(),
        meetings: z.number(),
        proposals: z.number(),
        negotiations: z.number(),
        closedClients: z.number(),
        conversionRate: z.number(),
        projectRevenue: z.number(),
      }),
      comparison: z.unknown(),
    })
    .parse(metricsResult.data);
  checks.push({
    endpoint: 'GET /metrics/commercial',
    status: 200,
    requestId: metricsResult.requestId,
    summary: {
      period: metrics.period,
      metricFields: Object.keys(metrics.metrics),
      comparisonReturned: metrics.comparison !== null,
    },
  });

  return { ok: true, baseUrl: base, checks };
}

const executedPath = process.argv[1]
  ? path.resolve(process.argv[1])
  : undefined;
if (executedPath === fileURLToPath(import.meta.url)) {
  const baseUrl = process.env.AGENT_API_BASE_URL?.trim();
  const token = process.env.AGENT_API_TOKEN?.trim();
  if (!baseUrl) throw new Error('Defina AGENT_API_BASE_URL.');
  if (!token) throw new Error('Defina AGENT_API_TOKEN.');
  const result = await runAgentApiConsumer({ baseUrl, token });
  console.log(JSON.stringify(result, null, 2));
}
