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
    'Não foi possível concluir a consulta.',
    500,
  );
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
