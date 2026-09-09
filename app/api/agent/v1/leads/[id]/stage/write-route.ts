import { readAgentJson, withAgentWrite } from '@/lib/agent-api';
import { agentSetLeadStageSchema } from '@/lib/agent-write-validation';
import { setAgentLeadStage } from '@/lib/agent-write-service';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAgentWrite(request, 'crm:leads:write', async (context, idempotencyKey) => {
    const { id } = await params;
    const input = agentSetLeadStageSchema.parse(await readAgentJson(request));
    return setAgentLeadStage(
      { ownerUserId: context.ownerUserId, actorKey: `opaque:${context.integrationId}` },
      idempotencyKey,
      id,
      input,
    );
  });
}

