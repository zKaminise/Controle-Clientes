import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  agentAccessTokens,
  agentAuditLogs,
  agentIntegrations,
  agentRateLimitBuckets,
  users,
} from '@/db/schema';
import { env } from '@/lib/env';

export const AGENT_READ_SCOPES = [
  'crm:leads:read',
  'crm:pipeline:read',
  'crm:followups:read',
  'crm:analysis:read',
  'crm:metrics:read',
] as const;

export const AGENT_WRITE_SCOPES = [
  'crm:leads:write',
  'crm:pipeline:write',
  'crm:interactions:write',
  'crm:followups:write',
  'crm:referrals:write',
  'crm:analysis:write',
] as const;

export const AGENT_SCOPES = [
  ...AGENT_READ_SCOPES,
  ...AGENT_WRITE_SCOPES,
] as const;

export type AgentScope = (typeof AGENT_SCOPES)[number];

export type AgentIdentity = {
  tokenId: string;
  tokenPrefix: string;
  integrationId: string;
  clientId: string;
  integrationName: string;
  ownerUserId: string;
  ownerEmail: string;
  audience: string;
  scopes: string[];
  status: 'active' | 'revoked';
  expiresAt: Date;
  tokenRevokedAt: Date | null;
  integrationRevokedAt: Date | null;
  rateLimitPerMinute: number;
};

export type AgentRequestContext = {
  requestId: string;
  integrationId: string;
  clientId: string;
  integrationName: string;
  ownerUserId: string;
  scope: AgentScope;
  tokenPrefix: string;
  rateLimit: {
    limit: number;
    remaining: number;
    resetAt: Date;
  };
};

export class AgentApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details: Record<string, unknown> = {},
    public readonly actor: Partial<AgentRequestContext> = {},
  ) {
    super(message);
    this.name = 'AgentApiError';
  }
}

export interface AgentAuthStore {
  incrementRateLimit(bucketKey: string, windowStart: Date): Promise<number>;
  findToken(tokenHash: string, now: Date): Promise<AgentIdentity | null>;
  touch(identity: AgentIdentity, now: Date): Promise<void>;
}

export interface AgentAuditStore {
  record(input: {
    requestId: string;
    integrationId?: string | null;
    ownerUserId?: string | null;
    tokenPrefix?: string | null;
    method: string;
    path: string;
    requiredScope: AgentScope;
    statusCode: number;
    errorCode?: string | null;
    durationMs: number;
    oauthClientId?: string | null;
    protocol?: string;
    toolName?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    changes?: Record<string, unknown> | null;
  }): Promise<void>;
}

export function hashAgentToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function generateAgentToken() {
  return `cca_${randomBytes(32).toString('base64url')}`;
}

export function agentTokenPrefix(token: string) {
  return token.slice(0, 16);
}

export function expectedAgentAudience() {
  const configured = env.AGENT_API_AUDIENCE;
  if (configured) return configured.replace(/\/$/, '');
  return new URL('/api/agent/v1', env.NEXT_PUBLIC_APP_URL)
    .toString()
    .replace(/\/$/, '');
}

export function allowedAgentAdminEmail() {
  return (
    env.AGENT_ALLOWED_ADMIN_EMAIL ||
    env.ADMIN_EMAIL ||
    'gabriel.misao08@gmail.com'
  ).toLowerCase();
}

export function parseBearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  const match = /^Bearer ([\x21-\x7e]{24,512})$/.exec(authorization || '');
  if (!match) {
    throw new AgentApiError(
      'AGENT_AUTH_REQUIRED',
      'Informe uma credencial Bearer válida.',
      401,
    );
  }
  return match[1];
}

function requestIpBucket(request: Request) {
  const forwarded = request.headers
    .get('x-forwarded-for')
    ?.split(',')[0]
    ?.trim();
  const address = forwarded || request.headers.get('x-real-ip') || 'unknown';
  return `preauth:${createHash('sha256').update(address).digest('hex')}`;
}

function minuteWindow(now: Date) {
  const start = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  return { start, resetAt: new Date(start.getTime() + 60_000) };
}

function actorFromIdentity(
  identity: AgentIdentity,
  scope: AgentScope,
): Partial<AgentRequestContext> {
  return {
    integrationId: identity.integrationId,
    clientId: identity.clientId,
    integrationName: identity.integrationName,
    ownerUserId: identity.ownerUserId,
    scope,
    tokenPrefix: identity.tokenPrefix,
  };
}

export const postgresAgentAuthStore: AgentAuthStore = {
  async incrementRateLimit(bucketKey, windowStart) {
    const [bucket] = await db
      .insert(agentRateLimitBuckets)
      .values({ bucketKey, windowStart, requestCount: 1 })
      .onConflictDoUpdate({
        target: [
          agentRateLimitBuckets.bucketKey,
          agentRateLimitBuckets.windowStart,
        ],
        set: {
          requestCount: sql`${agentRateLimitBuckets.requestCount} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning({ requestCount: agentRateLimitBuckets.requestCount });
    return bucket.requestCount;
  },

  async findToken(tokenHash, now) {
    const [identity] = await db
      .select({
        tokenId: agentAccessTokens.id,
        tokenPrefix: agentAccessTokens.tokenPrefix,
        integrationId: agentIntegrations.id,
        clientId: agentIntegrations.clientId,
        integrationName: agentIntegrations.name,
        ownerUserId: agentIntegrations.ownerUserId,
        ownerEmail: users.email,
        audience: agentIntegrations.audience,
        scopes: agentIntegrations.scopes,
        status: agentIntegrations.status,
        expiresAt: agentAccessTokens.expiresAt,
        tokenRevokedAt: agentAccessTokens.revokedAt,
        integrationRevokedAt: agentIntegrations.revokedAt,
        rateLimitPerMinute: agentIntegrations.rateLimitPerMinute,
      })
      .from(agentAccessTokens)
      .innerJoin(
        agentIntegrations,
        eq(agentAccessTokens.integrationId, agentIntegrations.id),
      )
      .innerJoin(users, eq(agentIntegrations.ownerUserId, users.id))
      .where(
        and(
          eq(agentAccessTokens.tokenHash, tokenHash),
          gt(agentAccessTokens.expiresAt, now),
          isNull(agentAccessTokens.revokedAt),
        ),
      )
      .limit(1);
    return identity || null;
  },

  async touch(identity, now) {
    await db.batch([
      db
        .update(agentAccessTokens)
        .set({ lastUsedAt: now })
        .where(eq(agentAccessTokens.id, identity.tokenId)),
      db
        .update(agentIntegrations)
        .set({ lastUsedAt: now, updatedAt: now })
        .where(eq(agentIntegrations.id, identity.integrationId)),
    ]);
  },
};

export const postgresAgentAuditStore: AgentAuditStore = {
  async record(input) {
    await db.insert(agentAuditLogs).values(input);
  },
};

export async function authenticateAgentRequest(
  request: Request,
  requiredScope: AgentScope,
  options: {
    store?: AgentAuthStore;
    now?: Date;
    requestId?: string;
    audience?: string;
    allowedAdminEmail?: string;
    preAuthLimit?: number;
  } = {},
): Promise<AgentRequestContext> {
  const store = options.store || postgresAgentAuthStore;
  const now = options.now || new Date();
  const requestId = options.requestId || randomUUID();
  const { start: windowStart, resetAt } = minuteWindow(now);

  const preAuthCount = await store.incrementRateLimit(
    requestIpBucket(request),
    windowStart,
  );
  if (preAuthCount > (options.preAuthLimit || 120)) {
    throw new AgentApiError(
      'AGENT_RATE_LIMITED',
      'Muitas tentativas de autenticação.',
      429,
      {
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((resetAt.getTime() - now.getTime()) / 1000),
        ),
      },
    );
  }

  const token = parseBearerToken(request);
  const tokenPrefix = agentTokenPrefix(token);
  const identity = await store.findToken(hashAgentToken(token), now);
  if (!identity) {
    throw new AgentApiError(
      'AGENT_TOKEN_INVALID',
      'Credencial inválida, expirada ou revogada.',
      401,
      {},
      { tokenPrefix },
    );
  }
  const actor = actorFromIdentity(identity, requiredScope);
  if (
    identity.status !== 'active' ||
    identity.integrationRevokedAt ||
    identity.tokenRevokedAt
  ) {
    throw new AgentApiError(
      'AGENT_INTEGRATION_REVOKED',
      'A integração está revogada.',
      401,
      {},
      actor,
    );
  }
  const allowedEmail = (
    options.allowedAdminEmail || allowedAgentAdminEmail()
  ).toLowerCase();
  if (identity.ownerEmail.toLowerCase() !== allowedEmail) {
    throw new AgentApiError(
      'AGENT_OWNER_FORBIDDEN',
      'A integração não pertence à conta administrativa autorizada.',
      403,
      {},
      actor,
    );
  }
  const audience = (options.audience || expectedAgentAudience()).replace(
    /\/$/,
    '',
  );
  if (identity.audience.replace(/\/$/, '') !== audience) {
    throw new AgentApiError(
      'AGENT_AUDIENCE_INVALID',
      'A credencial não foi emitida para este recurso.',
      403,
      {},
      actor,
    );
  }
  if (!identity.scopes.includes(requiredScope)) {
    throw new AgentApiError(
      'AGENT_SCOPE_REQUIRED',
      'A credencial não possui o scope necessário.',
      403,
      { requiredScope },
      actor,
    );
  }

  const limit = identity.rateLimitPerMinute;
  const count = await store.incrementRateLimit(
    `integration:${identity.integrationId}`,
    windowStart,
  );
  if (count > limit) {
    throw new AgentApiError(
      'AGENT_RATE_LIMITED',
      'Limite de requisições da integração excedido.',
      429,
      {
        limit,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((resetAt.getTime() - now.getTime()) / 1000),
        ),
      },
      actor,
    );
  }

  await store.touch(identity, now);
  return {
    requestId,
    integrationId: identity.integrationId,
    clientId: identity.clientId,
    integrationName: identity.integrationName,
    ownerUserId: identity.ownerUserId,
    scope: requiredScope,
    tokenPrefix: identity.tokenPrefix,
    rateLimit: {
      limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    },
  };
}
