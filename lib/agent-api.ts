import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import {
  AgentApiError,
  type AgentAuditStore,
  type AgentAuthStore,
  type AgentRequestContext,
  type AgentScope,
  authenticateAgentRequest,
  postgresAgentAuditStore,
} from '@/lib/agent-auth';
import { agentIdempotencyKeySchema } from '@/lib/agent-write-validation';
import type { AgentWriteResult } from '@/lib/agent-write-service';

type AgentApiDependencies = {
  authStore?: AgentAuthStore;
  auditStore?: AgentAuditStore;
  now?: Date;
  audience?: string;
  allowedAdminEmail?: string;
};

function responseHeaders(
  requestId: string,
  context?: AgentRequestContext,
  retryAfterSeconds?: number,
) {
  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    'X-Request-Id': requestId,
  });
  if (context) {
    headers.set('X-RateLimit-Limit', String(context.rateLimit.limit));
    headers.set('X-RateLimit-Remaining', String(context.rateLimit.remaining));
    headers.set(
      'X-RateLimit-Reset',
      String(Math.ceil(context.rateLimit.resetAt.getTime() / 1000)),
    );
  }
  if (retryAfterSeconds) headers.set('Retry-After', String(retryAfterSeconds));
  return headers;
}

function normalizeError(error: unknown) {
  if (error instanceof AgentApiError) return error;
  if (error instanceof ZodError) {
    return new AgentApiError(
      'AGENT_INVALID_REQUEST',
      'Parâmetros inválidos.',
      400,
      { issues: error.issues },
    );
  }
  if (error instanceof Error && error.message === 'Lead não encontrado.') {
    return new AgentApiError('AGENT_LEAD_NOT_FOUND', error.message, 404);
  }
  if (
    error instanceof Error &&
    error.message === 'Oportunidade não encontrada.'
  ) {
    return new AgentApiError('AGENT_OPPORTUNITY_NOT_FOUND', error.message, 404);
  }
  return new AgentApiError(
    'AGENT_INTERNAL_ERROR',
    'Não foi possível concluir a operação.',
    500,
  );
}

function requestIdempotencyKey(request: Request) {
  const value = request.headers.get('idempotency-key');
  if (!value) {
    throw new AgentApiError(
      'AGENT_IDEMPOTENCY_REQUIRED',
      'O header Idempotency-Key é obrigatório para escritas.',
      400,
    );
  }
  return agentIdempotencyKeySchema.parse(value);
}

export async function readAgentJson(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new AgentApiError(
      'AGENT_CONTENT_TYPE_REQUIRED',
      'Use Content-Type: application/json.',
      415,
    );
  }
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > 65_536) {
    throw new AgentApiError('AGENT_PAYLOAD_TOO_LARGE', 'Payload maior que 64 KiB.', 413);
  }
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > 65_536) {
      throw new AgentApiError('AGENT_PAYLOAD_TOO_LARGE', 'Payload maior que 64 KiB.', 413);
    }
    return JSON.parse(body) as unknown;
  } catch (error) {
    if (error instanceof AgentApiError) throw error;
    throw new AgentApiError('AGENT_INVALID_JSON', 'JSON inválido.', 400);
  }
}

export async function withAgentWrite<T>(
  request: Request,
  requiredScope: AgentScope,
  handler: (
    context: AgentRequestContext,
    idempotencyKey: string,
  ) => Promise<AgentWriteResult<T>>,
  dependencies: AgentApiDependencies = {},
) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const auditStore = dependencies.auditStore || postgresAgentAuditStore;
  let context: AgentRequestContext | undefined;
  let audit: AgentWriteResult<T>['audit'] | undefined;

  try {
    context = await authenticateAgentRequest(request, requiredScope, {
      store: dependencies.authStore,
      now: dependencies.now,
      requestId,
      audience: dependencies.audience,
      allowedAdminEmail: dependencies.allowedAdminEmail,
    });
    const idempotencyKey = requestIdempotencyKey(request);
    const result = await handler(context, idempotencyKey);
    audit = result.audit;
    await auditStore.record({
      requestId,
      integrationId: context.integrationId,
      ownerUserId: context.ownerUserId,
      tokenPrefix: context.tokenPrefix,
      method: request.method,
      path: new URL(request.url).pathname,
      requiredScope,
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      protocol: 'http',
      entityType: audit.entityType,
      entityId: audit.entityId,
      changes: audit.changes,
    });
    return Response.json(
      {
        data: result.data,
        meta: { requestId, idempotentReplay: result.replayed },
      },
      { headers: responseHeaders(requestId, context) },
    );
  } catch (unknownError) {
    const error = normalizeError(unknownError);
    const actor = context || error.actor;
    try {
      await auditStore.record({
        requestId,
        integrationId: actor.integrationId || null,
        ownerUserId: actor.ownerUserId || null,
        tokenPrefix: actor.tokenPrefix || null,
        method: request.method,
        path: new URL(request.url).pathname,
        requiredScope,
        statusCode: error.status,
        errorCode: error.code,
        durationMs: Date.now() - startedAt,
        protocol: 'http',
        entityType: audit?.entityType,
        entityId: audit?.entityId,
        changes: audit?.changes,
      });
    } catch (auditError) {
      console.error('Falha ao registrar auditoria de escrita do agente.', auditError);
    }
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          requestId,
          details: error.details,
        },
      },
      { status: error.status, headers: responseHeaders(requestId, context) },
    );
  }
}

export async function withAgentRead<T>(
  request: Request,
  requiredScope: AgentScope,
  handler: (context: AgentRequestContext) => Promise<T>,
  dependencies: AgentApiDependencies = {},
) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const auditStore = dependencies.auditStore || postgresAgentAuditStore;
  let context: AgentRequestContext | undefined;

  try {
    context = await authenticateAgentRequest(request, requiredScope, {
      store: dependencies.authStore,
      now: dependencies.now,
      requestId,
      audience: dependencies.audience,
      allowedAdminEmail: dependencies.allowedAdminEmail,
    });
    const data = await handler(context);
    await auditStore.record({
      requestId,
      integrationId: context.integrationId,
      ownerUserId: context.ownerUserId,
      tokenPrefix: context.tokenPrefix,
      method: request.method,
      path: new URL(request.url).pathname,
      requiredScope,
      statusCode: 200,
      durationMs: Date.now() - startedAt,
    });
    return Response.json(
      { data, meta: { requestId } },
      { headers: responseHeaders(requestId, context) },
    );
  } catch (unknownError) {
    const error = normalizeError(unknownError);
    const actor = context || error.actor;
    try {
      await auditStore.record({
        requestId,
        integrationId: actor.integrationId || null,
        ownerUserId: actor.ownerUserId || null,
        tokenPrefix: actor.tokenPrefix || null,
        method: request.method,
        path: new URL(request.url).pathname,
        requiredScope,
        statusCode: error.status,
        errorCode: error.code,
        durationMs: Date.now() - startedAt,
      });
    } catch (auditError) {
      console.error(
        'Falha ao registrar auditoria da API do agente.',
        auditError,
      );
    }
    const retryAfter =
      Number(error.details.retryAfterSeconds || 0) || undefined;
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          requestId,
          details: error.details,
        },
      },
      {
        status: error.status,
        headers: responseHeaders(requestId, context, retryAfter),
      },
    );
  }
}
