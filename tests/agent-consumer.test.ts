import { afterEach, describe, expect, it, vi } from 'vitest';
import { runAgentApiConsumer } from '@/scripts/test-agent-api';

const leadId = '11111111-1111-4111-8111-111111111111';
const fakeToken = 'cca_12345678901234567890123456789012';

function success(data: unknown) {
  const requestId = crypto.randomUUID();
  return Response.json(
    { data, meta: { requestId } },
    { headers: { 'x-request-id': requestId } },
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('real HTTP consumer contract', () => {
  it('validates every read-only CRM consultation without exposing secrets', async () => {
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const request =
          input instanceof Request ? input : new Request(input, init);
        const url = new URL(request.url);
        if (url.pathname.endsWith(`/leads/${leadId}/stage`))
          return success({ leadId, prospectingStatus: 'NOVO_LEAD' });
        if (url.pathname.endsWith(`/leads/${leadId}/score`))
          return success({
            leadId,
            leadScore: null,
            scoreLevel: null,
            priority: null,
            scoreBreakdown: null,
            analyzedAt: null,
          });
        if (url.pathname.endsWith(`/leads/${leadId}`))
          return success({ company: { id: leadId, name: 'Empresa' } });
        if (url.pathname.endsWith('/leads'))
          return success({
            items: [{ id: leadId }],
            pagination: { page: 1, pageSize: 5, total: 1, pages: 1 },
          });
        if (url.pathname.endsWith('/follow-ups'))
          return success({
            timezone: 'America/Sao_Paulo',
            overdue: [],
            today: [],
            upcoming: [],
            leadsWithoutAction: [],
          });
        if (url.pathname.endsWith('/attention'))
          return success({
            timezone: 'America/Sao_Paulo',
            items: url.searchParams.has('type')
              ? [{ type: 'lead_without_action' }]
              : [{ type: 'task' }],
          });
        if (url.pathname.endsWith('/metrics/commercial'))
          return success({
            period: {
              from: url.searchParams.get('from'),
              to: url.searchParams.get('to'),
              timezone: 'America/Sao_Paulo',
            },
            metrics: {
              newLeads: 1,
              contacts: 0,
              noResponse: 0,
              interested: 0,
              meetings: 0,
              proposals: 0,
              negotiations: 0,
              closedClients: 0,
              conversionRate: 0,
              projectRevenue: 0,
            },
            comparison: {},
          });
        return Response.json({ error: 'unexpected' }, { status: 500 });
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await runAgentApiConsumer({
      baseUrl: 'https://clientes.gabrielmisao.com.br/api/agent/v1',
      token: fakeToken,
    });
    expect(result.ok).toBe(true);
    expect(result.checks).toHaveLength(7);
    expect(fetchMock).toHaveBeenCalledTimes(8);
    for (const call of fetchMock.mock.calls) {
      const init = call[1];
      expect(new Headers(init?.headers).get('authorization')).toBe(
        `Bearer ${fakeToken}`,
      );
    }
    expect(JSON.stringify(result)).not.toContain(fakeToken);
  });
});
