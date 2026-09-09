import { z } from 'zod';
import { readAgentJson, withAgentRead, withAgentWrite } from '@/lib/agent-api';
import { listAgentProspectingBatches } from '@/lib/agent-prospecting-service';
import {
  agentCreateProspectingBatchSchema,
  prospectingBatchStatusSchema,
} from '@/lib/agent-prospecting-validation';
import { createAgentProspectingBatch } from '@/lib/agent-write-service';

export const dynamic = 'force-dynamic';

const querySchema = z
  .object({
    status: prospectingBatchStatusSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export async function GET(request: Request) {
  return withAgentRead(request, 'crm:prospecting:read', async (context) => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    return listAgentProspectingBatches(
      context.ownerUserId,
      querySchema.parse(params),
    );
  });
}

export async function POST(request: Request) {
  return withAgentWrite(
    request,
    'crm:prospecting:write',
    async (context, idempotencyKey) => {
      const input = agentCreateProspectingBatchSchema.parse(
        await readAgentJson(request),
      );
      return createAgentProspectingBatch(
        {
          ownerUserId: context.ownerUserId,
          actorKey: `opaque:${context.integrationId}`,
        },
        idempotencyKey,
        input,
      );
    },
  );
}
