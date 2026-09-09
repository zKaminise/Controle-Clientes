import { readAgentJson, withAgentWrite } from '@/lib/agent-api';
import { agentSetInteractionResultSchema } from '@/lib/agent-write-validation';
import { setAgentInteractionResult } from '@/lib/agent-write-service';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAgentWrite(request, 'crm:interactions:write', async (context, idempotencyKey) => {
    const { id } = await params;
    const input = agentSetInteractionResultSchema.parse(await readAgentJson(request));
    return setAgentInteractionResult(
      { ownerUserId: context.ownerUserId, actorKey: `opaque:${context.integrationId}` },
      idempotencyKey,
      id,
      input,
    );
  });
}

