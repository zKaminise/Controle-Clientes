import { readAgentJson, withAgentWrite } from '@/lib/agent-api';
import { agentCreateLeadSchema } from '@/lib/agent-write-validation';
import { createAgentLead } from '@/lib/agent-write-service';

export async function POST(request: Request) {
  return withAgentWrite(request, 'crm:leads:write', async (context, idempotencyKey) => {
    const input = agentCreateLeadSchema.parse(await readAgentJson(request));
    return createAgentLead(
      { ownerUserId: context.ownerUserId, actorKey: `opaque:${context.integrationId}` },
      idempotencyKey,
      input,
    );
  });
}

