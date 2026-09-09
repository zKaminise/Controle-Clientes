import { readAgentJson, withAgentWrite } from '@/lib/agent-api';
import { agentCreateInteractionSchema } from '@/lib/agent-write-validation';
import { createAgentInteraction } from '@/lib/agent-write-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return withAgentWrite(request, 'crm:interactions:write', async (context, idempotencyKey) => {
    const input = agentCreateInteractionSchema.parse(await readAgentJson(request));
    return createAgentInteraction(
      { ownerUserId: context.ownerUserId, actorKey: `opaque:${context.integrationId}` },
      idempotencyKey,
      input,
    );
  });
}

