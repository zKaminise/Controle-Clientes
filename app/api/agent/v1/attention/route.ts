import { withAgentRead } from '@/lib/agent-api';
import { getAgentAttention } from '@/lib/agent-read-service';
import {
  agentAttentionQuerySchema,
  strictSearchParams,
} from '@/lib/agent-validation';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return withAgentRead(request, 'crm:followups:read', async (context) => {
    const input = agentAttentionQuerySchema.parse(strictSearchParams(request));
    return getAgentAttention(context.ownerUserId, input);
  });
}
