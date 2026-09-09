import { readAgentJson, withAgentWrite } from '@/lib/agent-api';
import { agentCreateReferralSchema } from '@/lib/agent-write-validation';
import { createAgentReferral } from '@/lib/agent-write-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return withAgentWrite(request, 'crm:referrals:write', async (context, idempotencyKey) => {
    const input = agentCreateReferralSchema.parse(await readAgentJson(request));
    return createAgentReferral(
      { ownerUserId: context.ownerUserId, actorKey: `opaque:${context.integrationId}` },
      idempotencyKey,
      input,
    );
  });
}

