import { describe, expect, it, vi } from 'vitest';
import { withAgentRead } from '@/lib/agent-api';
import type {
  AgentAuditStore,
  AgentAuthStore,
  AgentIdentity,
} from '@/lib/agent-auth';

vi.mock('@/db', () => ({ db: {} }));
vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_APP_URL: 'https://clientes.gabrielmisao.com.br',
    AGENT_API_AUDIENCE: 'https://clientes.gabrielmisao.com.br/api/agent/v1',
    AGENT_ALLOWED_ADMIN_EMAIL: 'gabriel.misao08@gmail.com',
  },
}));

const token = 'cca_12345678901234567890123456789012';

function identity(): AgentIdentity {
  return {
    tokenId: 'token-id',
    tokenPrefix: token.slice(0, 16),
    integrationId: 'integration-id',
    clientId: 'codex',
    integrationName: 'Codex',
    ownerUserId: 'admin-id',
    ownerEmail: 'gabriel.misao08@gmail.com',
    audience: 'https://clientes.gabrielmisao.com.br/api/agent/v1',
    scopes: ['crm:leads:read'],
    status: 'active',
    expiresAt: new Date('2026-10-01T00:00:00Z'),
    tokenRevokedAt: null,
    integrationRevokedAt: null,
    rateLimitPerMinute: 60,
  };
}

function dependencies(valid = true) {
  const authStore: AgentAuthStore = {
    incrementRateLimit: vi.fn(async () => 1),
    findToken: vi.fn(async () => (valid ? identity() : null)),
    touch: vi.fn(async () => undefined),
  };
  const auditStore: AgentAuditStore = { record: vi.fn(async () => undefined) };
  return {
    authStore,
    auditStore,
    now: new Date('2026-09-08T12:00:00Z'),
    audience: 'https://clientes.gabrielmisao.com.br/api/agent/v1',
    allowedAdminEmail: 'gabriel.misao08@gmail.com',
  };
}

describe('agent API response contract', () => {
  it('returns data, request metadata, rate headers and an audit record', async () => {
    const deps = dependencies();
    const response = await withAgentRead(
      new Request('https://clientes.gabrielmisao.com.br/api/agent/v1/leads', {
        headers: { authorization: `Bearer ${token}` },
      }),
      'crm:leads:read',
      async (context) => ({ ownerUserId: context.ownerUserId, items: [] }),
      deps,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-ratelimit-limit')).toBe('60');
    const body = await response.json();
    expect(body).toMatchObject({
      data: { ownerUserId: 'admin-id', items: [] },
      meta: { requestId: expect.any(String) },
    });
    expect(deps.auditStore.record).toHaveBeenCalledWith(
      expect.objectContaining({
        integrationId: 'integration-id',
        requiredScope: 'crm:leads:read',
        statusCode: 200,
      }),
    );
  });

  it('uses the standardized error contract for unauthorized access', async () => {
    const deps = dependencies(false);
    const response = await withAgentRead(
      new Request('https://clientes.gabrielmisao.com.br/api/agent/v1/leads', {
        headers: { authorization: `Bearer ${token}` },
      }),
      'crm:leads:read',
      async () => ({ items: [] }),
      deps,
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'AGENT_TOKEN_INVALID',
        message: expect.any(String),
        requestId: expect.any(String),
        details: {},
      },
    });
    expect(deps.auditStore.record).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'AGENT_TOKEN_INVALID',
        statusCode: 401,
      }),
    );
  });
});
