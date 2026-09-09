import { readAgentJson, withAgentWrite } from '@/lib/agent-api';
import { agentMoveOpportunitySchema } from '@/lib/agent-write-validation';
import { moveAgentOpportunity } from '@/lib/agent-write-service';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAgentWrite(request, 'crm:pipeline:write', async (context, idempotencyKey) => {
    const { id } = await params;
    const input = agentMoveOpportunitySchema.parse(await readAgentJson(request));
    return moveAgentOpportunity(
      { ownerUserId: context.ownerUserId, actorKey: `opaque:${context.integrationId}` },
      idempotencyKey,
      id,
      input,
    );
  });
}

