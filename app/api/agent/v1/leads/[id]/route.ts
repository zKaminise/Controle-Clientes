import { z } from 'zod';
import { withAgentRead } from '@/lib/agent-api';
import { getAgentLead } from '@/lib/agent-read-service';
export { PATCH } from './write-route';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withAgentRead(request, 'crm:leads:read', async (agent) => {
    const { id } = await context.params;
    return getAgentLead(agent.ownerUserId, z.string().uuid().parse(id));
  });
}
