import { z } from 'zod';
import { readAgentJson, withAgentRead, withAgentWrite } from '@/lib/agent-api';
import { listAgentProspectingCandidates } from '@/lib/agent-prospecting-service';
import {
  agentAddProspectingCandidateSchema,
  prospectingCandidateStatusSchema,
} from '@/lib/agent-prospecting-validation';
import { addAgentProspectingCandidate } from '@/lib/agent-write-service';

export const dynamic = 'force-dynamic';

const querySchema = z
  .object({
    status: prospectingCandidateStatusSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withAgentRead(request, 'crm:prospecting:read', async (agent) => {
    const [{ id }, query] = await Promise.all([
      context.params,
      Promise.resolve(
        querySchema.parse(
          Object.fromEntries(new URL(request.url).searchParams),
        ),
      ),
    ]);
    return listAgentProspectingCandidates(agent.ownerUserId, {
      batchId: id,
      ...query,
    });
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withAgentWrite(
    request,
    'crm:prospecting:write',
    async (agent, idempotencyKey) => {
      const { id } = await context.params;
      const body = await readAgentJson(request);
      const input = agentAddProspectingCandidateSchema.parse({
        ...(body as object),
        batchId: id,
      });
      return addAgentProspectingCandidate(
        {
          ownerUserId: agent.ownerUserId,
          actorKey: `opaque:${agent.integrationId}`,
        },
        idempotencyKey,
        input,
      );
    },
  );
}
