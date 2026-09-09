import { withAgentRead } from '@/lib/agent-api';
import { getAgentProspectingBatch } from '@/lib/agent-prospecting-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withAgentRead(request, 'crm:prospecting:read', async (agent) => {
    const { id } = await context.params;
    return getAgentProspectingBatch(agent.ownerUserId, id);
  });
}
