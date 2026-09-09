import { describe, expect, it, vi } from 'vitest';
import {
  AgentApiError,
  authenticateAgentRequest,
  hashAgentToken,
  type AgentAuthStore,
  type AgentIdentity,
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
const now = new Date('2026-09-08T15:42:00.000Z');

function identity(overrides: Partial<AgentIdentity> = {}): AgentIdentity {
  return {
    tokenId: 'token-id',
    tokenPrefix: token.slice(0, 16),
    integrationId: 'integration-id',
    clientId: 'codex-production',
    integrationName: 'Codex',
    ownerUserId: 'admin-id',
    ownerEmail: 'gabriel.misao08@gmail.com',
    audience: 'https://clientes.gabrielmisao.com.br/api/agent/v1',
    scopes: ['crm:leads:read'],
    status: 'active',
    expiresAt: new Date('2026-10-08T15:42:00.000Z'),
    tokenRevokedAt: null,
    integrationRevokedAt: null,
    rateLimitPerMinute: 60,
    ...overrides,
  };
}

function store(
  options: {
    actor?: AgentIdentity | null;
    counts?: number[];
  } = {},
): AgentAuthStore {
  const counts = [...(options.counts || [1, 1])];
  return {
    incrementRateLimit: vi.fn(async () => counts.shift() || 1),
    findToken: vi.fn(async () =>
      options.actor === undefined ? identity() : options.actor,
    ),
    touch: vi.fn(async () => undefined),
  };
}

function request(headers: HeadersInit = {}) {
  return new Request(
    'https://clientes.gabrielmisao.com.br/api/agent/v1/leads',
    {
      headers,
    },
  );
}

const options = {
  now,
  requestId: 'request-id',
  audience: 'https://clientes.gabrielmisao.com.br/api/agent/v1',
  allowedAdminEmail: 'gabriel.misao08@gmail.com',
};

describe('agent authentication', () => {
  it('accepts a scoped, unexpired Bearer token without storing plaintext', async () => {
    const authStore = store();
    const result = await authenticateAgentRequest(
      request({ authorization: `Bearer ${token}` }),
      'crm:leads:read',
      { ...options, store: authStore },
    );
    expect(result).toMatchObject({
      ownerUserId: 'admin-id',
      integrationId: 'integration-id',
      scope: 'crm:leads:read',
      rateLimit: { limit: 60, remaining: 59 },
    });
    expect(authStore.findToken).toHaveBeenCalledWith(
      hashAgentToken(token),
      now,
    );
  });

  it('does not accept the administrative cookie as agent authentication', async () => {
    await expect(
      authenticateAgentRequest(
        request({ cookie: 'better-auth.session_token=secret' }),
        'crm:leads:read',
        { ...options, store: store() },
      ),
    ).rejects.toMatchObject({ code: 'AGENT_AUTH_REQUIRED', status: 401 });
  });

  it('rejects missing scopes', async () => {
    await expect(
      authenticateAgentRequest(
        request({ authorization: `Bearer ${token}` }),
        'crm:pipeline:read',
        { ...options, store: store() },
      ),
    ).rejects.toMatchObject({ code: 'AGENT_SCOPE_REQUIRED', status: 403 });
  });

  it('blocks identities owned by another user', async () => {
    await expect(
      authenticateAgentRequest(
        request({ authorization: `Bearer ${token}` }),
        'crm:leads:read',
        {
          ...options,
          store: store({
            actor: identity({ ownerEmail: 'other@example.com' }),
          }),
        },
      ),
    ).rejects.toMatchObject({ code: 'AGENT_OWNER_FORBIDDEN', status: 403 });
  });

  it('rejects expired, revoked or unknown tokens', async () => {
    await expect(
      authenticateAgentRequest(
        request({ authorization: `Bearer ${token}` }),
        'crm:leads:read',
        { ...options, store: store({ actor: null }) },
      ),
    ).rejects.toMatchObject({ code: 'AGENT_TOKEN_INVALID', status: 401 });
  });

  it('enforces the per-integration rate limit', async () => {
    await expect(
      authenticateAgentRequest(
        request({ authorization: `Bearer ${token}` }),
        'crm:leads:read',
        {
          ...options,
          store: store({
            actor: identity({ rateLimitPerMinute: 1 }),
            counts: [1, 2],
          }),
        },
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<AgentApiError>>({
        code: 'AGENT_RATE_LIMITED',
        status: 429,
      }),
    );
  });
});
