import { withAgentWrite } from '@/lib/agent-api';
import { promoteAgentProspectingCandidate } from '@/lib/agent-write-service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withAgentWrite(
    request,
    'crm:prospecting:write',
    async (agent, idempotencyKey) => {
      const { id } = await context.params;
      return promoteAgentProspectingCandidate(
        {
          ownerUserId: agent.ownerUserId,
          actorKey: `opaque:${agent.integrationId}`,
        },
        idempotencyKey,
        id,
      );
    },
  );
}
