import { withAgentRead } from '@/lib/agent-api';
import { getAgentFollowUps } from '@/lib/agent-read-service';
import {
  agentFollowUpQuerySchema,
  strictSearchParams,
} from '@/lib/agent-validation';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return withAgentRead(request, 'crm:followups:read', async (context) => {
    const input = agentFollowUpQuerySchema.parse(strictSearchParams(request));
    return getAgentFollowUps(context.ownerUserId, input);
  });
}
