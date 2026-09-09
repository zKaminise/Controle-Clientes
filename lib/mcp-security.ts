import { randomUUID } from 'node:crypto';
import type { JWTPayload } from 'jose';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { agentAuditLogs, agentRateLimitBuckets, users } from '@/db/schema';
import { AgentApiError } from '@/lib/agent-auth';
import {
  type McpCrmScope,
  mcpAllowedAdminEmail,
  mcpResourceUrl,
} from '@/lib/mcp-config';

export type McpPrincipal = {
  ownerUserId: string;
  ownerEmail: string;
  clientId: string;
  scopes: string[];
  authInfo: AuthInfo;
};

function claimScopes(claims: JWTPayload) {
  const value = claims.scope;
  if (Array.isArray(value)) return value.filter((scope): scope is string => typeof scope === 'string');
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean);
  const alternate = claims.scopes;
  return Array.isArray(alternate)
    ? alternate.filter((scope): scope is string => typeof scope === 'string')
    : [];
}

function bearerToken(request: Request) {
  return request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
}

export async function authorizeMcpRequest(request: Request, claims: JWTPayload): Promise<McpPrincipal> {
  const ownerUserId = typeof claims.sub === 'string' ? claims.sub : '';
  const clientId = String(claims.client_id || claims.azp || 'unknown-client');
  if (!ownerUserId) {
    throw new AgentApiError('MCP_SUBJECT_REQUIRED', 'Token OAuth sem usuário associado.', 401);
  }

  const [owner] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.id, ownerUserId), eq(users.email, mcpAllowedAdminEmail())))
    .limit(1);
  if (!owner) {
    throw new AgentApiError(
      'MCP_OWNER_FORBIDDEN',
      'A integração não pertence à conta administrativa autorizada.',
      403,
    );
  }

  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const bucketKey = `mcp:${ownerUserId}:${clientId}`.slice(0, 128);
  const [bucket] = await db
    .insert(agentRateLimitBuckets)
    .values({ bucketKey, windowStart, requestCount: 1 })
    .onConflictDoUpdate({
      target: [agentRateLimitBuckets.bucketKey, agentRateLimitBuckets.windowStart],
      set: {
        requestCount: sql`${agentRateLimitBuckets.requestCount} + 1`,
        updatedAt: now,
      },
    })
    .returning({ requestCount: agentRateLimitBuckets.requestCount });
  if (bucket.requestCount > 120) {
    throw new AgentApiError('MCP_RATE_LIMITED', 'Limite de requisições MCP excedido.', 429);
  }

  const scopes = claimScopes(claims);
  return {
    ownerUserId,
    ownerEmail: owner.email,
    clientId,
    scopes,
    authInfo: {
      token: bearerToken(request),
      clientId,
      scopes,
      expiresAt: typeof claims.exp === 'number' ? claims.exp : undefined,
      resource: new URL(mcpResourceUrl()),
      extra: { ownerUserId, ownerEmail: owner.email },
    },
  };
}

export function hasMcpScope(principal: McpPrincipal, scope: McpCrmScope) {
  return principal.scopes.includes(scope);
}

export async function withMcpToolAudit<T>(
  principal: McpPrincipal,
  toolName: string,
  requiredScope: McpCrmScope,
  handler: () => Promise<T>,
  audit?:
    | { entityType?: string; entityId?: string; changes?: Record<string, unknown> }
    | ((result: T | undefined) => {
        entityType?: string;
        entityId?: string;
        changes?: Record<string, unknown>;
      }),
) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let statusCode = 200;
  let errorCode: string | null = null;
  let result: T | undefined;
  try {
    if (!hasMcpScope(principal, requiredScope)) {
      throw new AgentApiError(
        'MCP_SCOPE_REQUIRED',
        `O scope ${requiredScope} é necessário.`,
        403,
        { requiredScope },
      );
    }
    result = await handler();
    return result;
  } catch (error) {
    statusCode = error instanceof AgentApiError ? error.status : 500;
    errorCode = error instanceof AgentApiError ? error.code : 'MCP_TOOL_ERROR';
    throw error;
  } finally {
    try {
      const auditData = typeof audit === 'function' ? audit(result) : audit;
      await db.insert(agentAuditLogs).values({
        requestId,
        ownerUserId: principal.ownerUserId,
        oauthClientId: principal.clientId,
        protocol: 'mcp',
        toolName,
        method: 'TOOLS_CALL',
        path: '/mcp',
        requiredScope,
        statusCode,
        errorCode,
        durationMs: Date.now() - startedAt,
        entityType: auditData?.entityType,
        entityId: auditData?.entityId,
        changes: auditData?.changes,
      });
    } catch (auditError) {
      console.error('Falha ao registrar auditoria MCP.', auditError);
    }
  }
}
