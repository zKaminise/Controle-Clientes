import { readAgentJson, withAgentWrite } from '@/lib/agent-api';
import { agentUpsertDigitalAnalysisSchema } from '@/lib/agent-write-validation';
import { upsertAgentDigitalAnalysis } from '@/lib/agent-write-service';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAgentWrite(request, 'crm:analysis:write', async (context, idempotencyKey) => {
    const { id } = await params;
    const input = agentUpsertDigitalAnalysisSchema.parse(await readAgentJson(request));
    return upsertAgentDigitalAnalysis(
      { ownerUserId: context.ownerUserId, actorKey: `opaque:${context.integrationId}` },
      idempotencyKey,
      id,
      input,
    );
  });
}

