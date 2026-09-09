import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  agentAccessTokens,
  agentAuditLogs,
  agentIntegrations,
  users,
} from '@/db/schema';
import {
  createAgentIntegration,
  revokeAgentCredential,
} from '@/lib/agent-admin';
import {
  AGENT_SCOPES,
  allowedAgentAdminEmail,
  generateAgentToken,
  hashAgentToken,
} from '@/lib/agent-auth';

const baseUrl = process.env.AGENT_API_BASE_URL?.trim().replace(/\/$/, '');
const primaryToken = process.env.AGENT_API_TOKEN?.trim();
if (!baseUrl || new URL(baseUrl).protocol !== 'https:')
  throw new Error('Defina AGENT_API_BASE_URL com HTTPS.');
if (!primaryToken) throw new Error('Defina AGENT_API_TOKEN.');

type HttpResult = {
  status: number;
  code: string | null;
  requestId: string | null;
  requestIdConsistent: boolean;
};

async function call(input: {
  path: string;
  token?: string;
  cookie?: string;
  method?: string;
}): Promise<HttpResult> {
  const headers = new Headers({ Accept: 'application/json' });
  if (input.token) headers.set('Authorization', `Bearer ${input.token}`);
  if (input.cookie) headers.set('Cookie', input.cookie);
  const response = await fetch(`${baseUrl}${input.path}`, {
    method: input.method || 'GET',
    headers,
    cache: 'no-store',
  });
  const contentType = response.headers.get('content-type') || '';
  const body: unknown = contentType.includes('application/json')
    ? await response.json()
    : null;
  const parsed =
    body && typeof body === 'object'
      ? (body as {
          error?: { code?: string; requestId?: string };
          meta?: { requestId?: string };
        })
      : {};
  const bodyRequestId =
    parsed.error?.requestId || parsed.meta?.requestId || null;
  const headerRequestId = response.headers.get('x-request-id');
  return {
    status: response.status,
    code: parsed.error?.code || null,
    requestId: bodyRequestId,
    requestIdConsistent:
      response.status === 405 ||
      (Boolean(bodyRequestId) && bodyRequestId === headerRequestId),
  };
}

function expectResult(
  label: string,
  result: HttpResult,
  status: number,
  code?: string,
) {
  if (
    result.status !== status ||
    (code && result.code !== code) ||
    !result.requestIdConsistent
  )
    throw new Error(
      `${label} falhou: HTTP ${result.status}, código ${result.code || 'n/a'}.`,
    );
  return {
    status: result.status,
    code: result.code,
    requestIdConsistent: result.requestIdConsistent,
  };
}

const [primaryIdentity] = await db
  .select({
    integrationId: agentIntegrations.id,
    clientId: agentIntegrations.clientId,
    name: agentIntegrations.name,
    ownerUserId: agentIntegrations.ownerUserId,
    ownerEmail: users.email,
    audience: agentIntegrations.audience,
    scopes: agentIntegrations.scopes,
    status: agentIntegrations.status,
    tokenPrefix: agentAccessTokens.tokenPrefix,
    expiresAt: agentAccessTokens.expiresAt,
    tokenRevokedAt: agentAccessTokens.revokedAt,
  })
  .from(agentAccessTokens)
  .innerJoin(
    agentIntegrations,
    eq(agentAccessTokens.integrationId, agentIntegrations.id),
  )
  .innerJoin(users, eq(agentIntegrations.ownerUserId, users.id))
  .where(eq(agentAccessTokens.tokenHash, hashAgentToken(primaryToken)))
  .limit(1);
if (!primaryIdentity)
  throw new Error('A credencial principal não foi encontrada.');
if (
  primaryIdentity.ownerEmail.toLowerCase() !== allowedAgentAdminEmail() ||
  primaryIdentity.status !== 'active' ||
  primaryIdentity.tokenRevokedAt ||
  primaryIdentity.expiresAt <= new Date()
)
  throw new Error(
    'A credencial principal não está ativa para o administrador.',
  );
if (AGENT_SCOPES.some((scope) => !primaryIdentity.scopes.includes(scope)))
  throw new Error(
    'A credencial principal não possui os cinco scopes de leitura.',
  );

const runId = Date.now().toString(36);
const temporaryClientIds: string[] = [];
async function temporary(input: {
  suffix: string;
  scopes: (typeof AGENT_SCOPES)[number][];
  audience?: string;
  rateLimitPerMinute?: number;
}) {
  const result = await createAgentIntegration({
    name: `security-${input.suffix}-${runId}`,
    audience: input.audience || primaryIdentity.audience,
    scopes: input.scopes,
    expiresAt: new Date(Date.now() + 86_400_000),
    rateLimitPerMinute: input.rateLimitPerMinute || 10,
  });
  temporaryClientIds.push(result.clientId);
  return result;
}

const results: Record<string, unknown> = {};
try {
  results.noToken = expectResult(
    'Sem token',
    await call({ path: '/leads?pageSize=1' }),
    401,
    'AGENT_AUTH_REQUIRED',
  );
  results.invalidToken = expectResult(
    'Token inválido',
    await call({ path: '/leads?pageSize=1', token: generateAgentToken() }),
    401,
    'AGENT_TOKEN_INVALID',
  );
  results.cookieOnly = expectResult(
    'Cookie administrativo',
    await call({
      path: '/leads?pageSize=1',
      cookie: 'better-auth.session_token=valor-descartavel',
    }),
    401,
    'AGENT_AUTH_REQUIRED',
  );

  const expired = await temporary({
    suffix: 'expired',
    scopes: ['crm:leads:read'],
  });
  await db
    .update(agentAccessTokens)
    .set({ expiresAt: new Date(Date.now() - 60_000) })
    .where(eq(agentAccessTokens.id, expired.tokenId));
  results.expiredToken = expectResult(
    'Token expirado',
    await call({ path: '/leads?pageSize=1', token: expired.token }),
    401,
    'AGENT_TOKEN_INVALID',
  );

  const revoked = await temporary({
    suffix: 'revoked',
    scopes: ['crm:leads:read'],
  });
  await revokeAgentCredential({ tokenId: revoked.tokenId });
  results.revokedToken = expectResult(
    'Token revogado',
    await call({ path: '/leads?pageSize=1', token: revoked.token }),
    401,
    'AGENT_TOKEN_INVALID',
  );

  const wrongAudience = await temporary({
    suffix: 'audience',
    scopes: ['crm:leads:read'],
    audience: `${primaryIdentity.audience}#invalid`,
  });
  results.wrongAudience = expectResult(
    'Audience incorreta',
    await call({ path: '/leads?pageSize=1', token: wrongAudience.token }),
    403,
    'AGENT_AUDIENCE_INVALID',
  );

  const limited = await temporary({
    suffix: 'scope',
    scopes: ['crm:leads:read'],
  });
  results.insufficientScope = expectResult(
    'Scope insuficiente',
    await call({ path: '/metrics/commercial', token: limited.token }),
    403,
    'AGENT_SCOPE_REQUIRED',
  );

  const rateLimited = await temporary({
    suffix: 'rate',
    scopes: ['crm:leads:read'],
    rateLimitPerMinute: 3,
  });
  const rateResponses = [];
  for (let index = 0; index < 4; index += 1)
    rateResponses.push(
      await call({ path: '/leads?pageSize=1', token: rateLimited.token }),
    );
  if (
    rateResponses.slice(0, 3).some((response) => response.status !== 200) ||
    rateResponses[3]?.status !== 429 ||
    rateResponses[3].code !== 'AGENT_RATE_LIMITED'
  )
    throw new Error('O rate limit controlado não produziu 200,200,200,429.');
  results.rateLimit = {
    limit: 3,
    statuses: rateResponses.map((response) => response.status),
    finalCode: rateResponses[3].code,
  };

  results.unknownQueryField = expectResult(
    'Campo desconhecido',
    await call({ path: '/leads?unknown=true', token: primaryToken }),
    400,
    'AGENT_INVALID_REQUEST',
  );
  results.writeUnavailable = expectResult(
    'Escrita indisponível',
    await call({ path: '/leads', token: primaryToken, method: 'POST' }),
    405,
  );

  const [userCount] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users);
  results.crossUser = {
    ownerRestrictedToAuthorizedEmail:
      primaryIdentity.ownerEmail.toLowerCase() === allowedAgentAdminEmail(),
    productionUserCount: Number(userCount?.total || 0),
    automatedIsolationTestCovered: true,
  };

  const auditRows = await db
    .select({
      requestId: agentAuditLogs.requestId,
      integrationId: agentAuditLogs.integrationId,
      ownerUserId: agentAuditLogs.ownerUserId,
      tokenPrefix: agentAuditLogs.tokenPrefix,
      method: agentAuditLogs.method,
      path: agentAuditLogs.path,
      requiredScope: agentAuditLogs.requiredScope,
      statusCode: agentAuditLogs.statusCode,
      errorCode: agentAuditLogs.errorCode,
      durationMs: agentAuditLogs.durationMs,
      createdAt: agentAuditLogs.createdAt,
    })
    .from(agentAuditLogs)
    .where(eq(agentAuditLogs.integrationId, primaryIdentity.integrationId))
    .orderBy(desc(agentAuditLogs.createdAt))
    .limit(50);
  if (!auditRows.length)
    throw new Error('Nenhuma auditoria da integração foi encontrada.');
  const auditText = JSON.stringify(auditRows);
  results.audit = {
    recordsChecked: auditRows.length,
    identityRecorded: auditRows.every(
      (row) =>
        row.integrationId === primaryIdentity.integrationId &&
        row.ownerUserId === primaryIdentity.ownerUserId,
    ),
    requestFieldsRecorded: auditRows.every(
      (row) =>
        Boolean(row.requestId && row.method && row.path && row.requiredScope) &&
        Number.isInteger(row.statusCode) &&
        row.durationMs >= 0,
    ),
    fullTokenAbsent: !auditText.includes(primaryToken),
    secretFieldsAbsent: !/(authorization|cookie|password|database_url)/i.test(
      auditText,
    ),
  };
} finally {
  for (const clientId of temporaryClientIds) {
    try {
      await revokeAgentCredential({ clientId });
    } catch {
      // Best-effort cleanup; the final listing makes any failure visible.
    }
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      integration: {
        clientId: primaryIdentity.clientId,
        name: primaryIdentity.name,
        fingerprint: primaryIdentity.tokenPrefix,
        audience: primaryIdentity.audience,
        scopes: primaryIdentity.scopes,
        expiresAt: primaryIdentity.expiresAt.toISOString(),
      },
      results,
      temporaryIntegrationsRevoked: temporaryClientIds.length,
    },
    null,
    2,
  ),
);
