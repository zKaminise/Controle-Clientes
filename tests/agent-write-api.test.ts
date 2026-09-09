import { describe, expect, it, vi } from 'vitest';
import { withAgentWrite } from '@/lib/agent-api';
import type { AgentAuditStore, AgentAuthStore, AgentIdentity } from '@/lib/agent-auth';

vi.mock('@/db', () => ({ db: {} }));
vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_APP_URL: 'https://clientes.gabrielmisao.com.br',
    AGENT_API_AUDIENCE: 'https://clientes.gabrielmisao.com.br/api/agent/v1',
    AGENT_ALLOWED_ADMIN_EMAIL: 'gabriel.misao08@gmail.com',
  },
}));

const token = 'cca_12345678901234567890123456789012';

function identity(scopes: string[]): AgentIdentity {
  return {
    tokenId: 'token-id',
    tokenPrefix: token.slice(0, 16),
    integrationId: 'integration-id',
    clientId: 'codex',
    integrationName: 'Codex',
    ownerUserId: 'admin-id',
    ownerEmail: 'gabriel.misao08@gmail.com',
    audience: 'https://clientes.gabrielmisao.com.br/api/agent/v1',
    scopes,
    status: 'active',
    expiresAt: new Date('2026-10-01T00:00:00Z'),
    tokenRevokedAt: null,
    integrationRevokedAt: null,
    rateLimitPerMinute: 60,
  };
}

function dependencies(scopes: string[]) {
  const authStore: AgentAuthStore = {
    incrementRateLimit: vi.fn(async () => 1),
    findToken: vi.fn(async () => identity(scopes)),
    touch: vi.fn(async () => undefined),
  };
  const auditStore: AgentAuditStore = { record: vi.fn(async () => undefined) };
  return {
    authStore,
    auditStore,
    now: new Date('2026-09-09T12:00:00Z'),
    audience: 'https://clientes.gabrielmisao.com.br/api/agent/v1',
    allowedAdminEmail: 'gabriel.misao08@gmail.com',
  };
}

describe('agent write API contract', () => {
  it('recusa escrita sem Idempotency-Key antes de executar o handler', async () => {
    const deps = dependencies(['crm:leads:write']);
    const handler = vi.fn();
    const response = await withAgentWrite(
      new Request('https://clientes.gabrielmisao.com.br/api/agent/v1/leads', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      }),
      'crm:leads:write',
      handler,
      deps,
    );
    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'AGENT_IDEMPOTENCY_REQUIRED' },
    });
  });

  it('recusa credencial legada somente leitura em endpoint de escrita', async () => {
    const deps = dependencies(['crm:leads:read']);
    const response = await withAgentWrite(
      new Request('https://clientes.gabrielmisao.com.br/api/agent/v1/leads', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'idempotency-key': 'write-test:0001',
        },
      }),
      'crm:leads:write',
      async () => {
        throw new Error('não deve executar');
      },
      deps,
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'AGENT_SCOPE_REQUIRED' },
    });
  });

  it('retorna replay idempotente e grava before/after na auditoria', async () => {
    const deps = dependencies(['crm:leads:write']);
    const response = await withAgentWrite(
      new Request('https://clientes.gabrielmisao.com.br/api/agent/v1/leads', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'idempotency-key': 'write-test:0002',
        },
      }),
      'crm:leads:write',
      async (_context, key) => ({
        data: { id: 'lead-id' },
        replayed: true,
        audit: {
          entityType: 'companies',
          entityId: 'lead-id',
          changes: { before: null, after: { name: 'Lead' }, key },
        },
      }),
      deps,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { id: 'lead-id' },
      meta: { idempotentReplay: true },
    });
    expect(deps.auditStore.record).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'companies',
        entityId: 'lead-id',
        changes: expect.objectContaining({ before: null, after: { name: 'Lead' } }),
      }),
    );
  });
});

