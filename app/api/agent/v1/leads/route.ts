import { withAgentRead } from '@/lib/agent-api';
import { searchAgentLeads } from '@/lib/agent-read-service';
import {
  agentLeadSearchSchema,
  strictSearchParams,
} from '@/lib/agent-validation';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return withAgentRead(request, 'crm:leads:read', async (context) => {
    const input = agentLeadSearchSchema.parse(strictSearchParams(request));
    return searchAgentLeads(context.ownerUserId, input);
  });
}
