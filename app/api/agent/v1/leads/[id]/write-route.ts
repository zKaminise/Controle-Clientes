import { readAgentJson, withAgentWrite } from '@/lib/agent-api';
import { agentUpdateLeadSchema } from '@/lib/agent-write-validation';
import { updateAgentLead } from '@/lib/agent-write-service';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAgentWrite(request, 'crm:leads:write', async (context, idempotencyKey) => {
    const { id } = await params;
    const input = agentUpdateLeadSchema.parse(await readAgentJson(request));
    return updateAgentLead(
      { ownerUserId: context.ownerUserId, actorKey: `opaque:${context.integrationId}` },
      idempotencyKey,
      id,
      input,
    );
  });
}

