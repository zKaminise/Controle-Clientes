import { readAgentJson, withAgentWrite } from '@/lib/agent-api';
import { agentCreateFollowUpSchema } from '@/lib/agent-write-validation';
import { createAgentFollowUp } from '@/lib/agent-write-service';

export async function POST(request: Request) {
  return withAgentWrite(request, 'crm:followups:write', async (context, idempotencyKey) => {
    const input = agentCreateFollowUpSchema.parse(await readAgentJson(request));
    return createAgentFollowUp(
      { ownerUserId: context.ownerUserId, actorKey: `opaque:${context.integrationId}` },
      idempotencyKey,
      input,
    );
  });
}

