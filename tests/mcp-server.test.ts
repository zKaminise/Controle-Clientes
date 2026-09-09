import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCrmMcpServer } from '@/lib/mcp-server';
import type { McpPrincipal } from '@/lib/mcp-security';

vi.mock('@/db', () => ({ db: {} }));
vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_APP_URL: 'https://clientes.gabrielmisao.com.br',
    BETTER_AUTH_URL: 'https://clientes.gabrielmisao.com.br',
    AGENT_ALLOWED_ADMIN_EMAIL: 'gabriel.misao08@gmail.com',
  },
}));

const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
});

function principal(scopes: string[]): McpPrincipal {
  return {
    ownerUserId: '11111111-1111-4111-8111-111111111111',
    ownerEmail: 'gabriel.misao08@gmail.com',
    clientId: 'https://chatgpt.com/.well-known/oauth-client',
    scopes,
    authInfo: {
      token: 'test-token',
      clientId: 'https://chatgpt.com/.well-known/oauth-client',
      scopes,
      expiresAt: Math.floor(Date.now() / 1000) + 900,
      resource: new URL('https://clientes.gabrielmisao.com.br/mcp'),
    },
  };
}

async function listTools(scopes: string[]) {
  const server = createCrmMcpServer(principal(scopes));
  const client = new Client({ name: 'crm-test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  closers.push(() => client.close(), () => server.close());
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client.listTools();
}

describe('CRM MCP Gate A', () => {
  it('expõe exatamente as oito ferramentas de leitura previstas', async () => {
    const response = await listTools([
      'crm:leads:read',
      'crm:pipeline:read',
      'crm:followups:read',
      'crm:analysis:read',
      'crm:metrics:read',
    ]);

    expect(response.tools.map((tool) => tool.name).sort()).toEqual([
      'crm_get_attention',
      'crm_get_commercial_metrics',
      'crm_get_follow_ups',
      'crm_get_lead',
      'crm_get_lead_score',
      'crm_get_lead_stage',
      'crm_get_opportunity_stage',
      'crm_search_leads',
    ]);
    expect(response.tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
    expect(response.tools.every((tool) => tool.annotations?.destructiveHint === false)).toBe(true);
  });

  it('oculta ferramentas cujo scope não foi concedido', async () => {
    const response = await listTools(['crm:analysis:read']);
    expect(response.tools.map((tool) => tool.name)).toEqual(['crm_get_lead_score']);
  });

  it('não expõe operações sensíveis nem ferramentas de escrita no Gate A', async () => {
    const response = await listTools([
      'crm:leads:read',
      'crm:pipeline:read',
      'crm:followups:read',
      'crm:analysis:read',
      'crm:metrics:read',
    ]);
    const names = response.tools.map((tool) => tool.name).join(' ');
    expect(names).not.toMatch(/delete|payment|user|config|bulk|create|update|set|move|upsert/);
  });

  it('expõe somente as nove escritas normais quando os scopes do Gate B são concedidos', async () => {
    const response = await listTools([
      'crm:leads:write',
      'crm:pipeline:write',
      'crm:interactions:write',
      'crm:followups:write',
      'crm:referrals:write',
      'crm:analysis:write',
    ]);
    expect(response.tools.map((tool) => tool.name).sort()).toEqual([
      'crm_create_follow_up',
      'crm_create_interaction',
      'crm_create_lead',
      'crm_create_referral',
      'crm_move_opportunity',
      'crm_set_interaction_result',
      'crm_set_lead_stage',
      'crm_update_lead',
      'crm_upsert_digital_analysis',
    ]);
    expect(response.tools.every((tool) => tool.annotations?.readOnlyHint === false)).toBe(true);
    expect(response.tools.every((tool) => tool.annotations?.destructiveHint === false)).toBe(true);
    expect(response.tools.every((tool) => tool.annotations?.idempotentHint === true)).toBe(true);
    expect(response.tools.map((tool) => tool.name).join(' ')).not.toMatch(
      /delete|payment|user|config|bulk/,
    );
  });
});
