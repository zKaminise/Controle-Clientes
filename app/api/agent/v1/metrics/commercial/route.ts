import { withAgentRead } from '@/lib/agent-api';
import { getAgentCommercialMetrics } from '@/lib/agent-read-service';
import {
  agentMetricsQuerySchema,
  strictSearchParams,
} from '@/lib/agent-validation';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return withAgentRead(request, 'crm:metrics:read', async (context) => {
    const input = agentMetricsQuerySchema.parse(strictSearchParams(request));
    return getAgentCommercialMetrics(context.ownerUserId, input);
  });
}
