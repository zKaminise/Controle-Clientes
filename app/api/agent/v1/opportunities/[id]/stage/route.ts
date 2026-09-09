import { z } from 'zod';
import { withAgentRead } from '@/lib/agent-api';
import { getAgentOpportunityStage } from '@/lib/agent-read-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withAgentRead(request, 'crm:pipeline:read', async (agent) => {
    const { id } = await context.params;
    return getAgentOpportunityStage(
      agent.ownerUserId,
      z.string().uuid().parse(id),
    );
  });
}
