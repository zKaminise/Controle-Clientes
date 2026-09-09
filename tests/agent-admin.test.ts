import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAgentIntegrationSchema } from '@/lib/agent-admin';
import { AGENT_SCOPES } from '@/lib/agent-auth';

vi.mock('@/db', () => ({ db: {} }));
vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_APP_URL: 'https://clientes.gabrielmisao.com.br',
    AGENT_API_AUDIENCE: 'https://clientes.gabrielmisao.com.br/api/agent/v1',
    AGENT_ALLOWED_ADMIN_EMAIL: 'gabriel.misao08@gmail.com',
  },
}));

afterEach(() => vi.useRealTimers());

describe('agent credential issuance contract', () => {
  it('accepts only explicit read scopes with expiration', () => {
    vi.setSystemTime(new Date('2026-09-09T12:00:00Z'));
    const result = createAgentIntegrationSchema.parse({
      name: 'codex-readonly',
      audience: 'https://clientes.gabrielmisao.com.br/api/agent/v1',
      scopes: [...AGENT_SCOPES],
      expiresAt: new Date('2026-11-08T12:00:00Z'),
      rateLimitPerMinute: 60,
    });
    expect(result.scopes).toEqual(AGENT_SCOPES);
  });

  it('rejects expiration in the past, wildcard scopes and unknown fields', () => {
    vi.setSystemTime(new Date('2026-09-09T12:00:00Z'));
    const base = {
      name: 'codex-readonly',
      audience: 'https://clientes.gabrielmisao.com.br/api/agent/v1',
      scopes: ['crm:leads:read'],
      expiresAt: new Date('2026-11-08T12:00:00Z'),
      rateLimitPerMinute: 60,
    };
    expect(() =>
      createAgentIntegrationSchema.parse({
        ...base,
        expiresAt: new Date('2026-09-08T12:00:00Z'),
      }),
    ).toThrow('A expiração deve estar no futuro');
    expect(() =>
      createAgentIntegrationSchema.parse({ ...base, scopes: ['crm:*'] }),
    ).toThrow();
    expect(() =>
      createAgentIntegrationSchema.parse({ ...base, secret: 'forbidden' }),
    ).toThrow();
  });
});
