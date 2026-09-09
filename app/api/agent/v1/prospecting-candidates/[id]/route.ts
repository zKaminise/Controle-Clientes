import { readAgentJson, withAgentWrite } from '@/lib/agent-api';
import { agentUpdateProspectingCandidateSchema } from '@/lib/agent-prospecting-validation';
import { updateAgentProspectingCandidate } from '@/lib/agent-write-service';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withAgentWrite(
    request,
    'crm:prospecting:write',
    async (agent, idempotencyKey) => {
      const { id } = await context.params;
      const input = agentUpdateProspectingCandidateSchema.parse(
        await readAgentJson(request),
      );
      return updateAgentProspectingCandidate(
        {
          ownerUserId: agent.ownerUserId,
          actorKey: `opaque:${agent.integrationId}`,
        },
        idempotencyKey,
        id,
        input,
      );
    },
  );
}
