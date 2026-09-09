import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { prospectingBatches, prospectingCandidates } from '@/db/schema';
import { AgentApiError } from '@/lib/agent-auth';

export async function listAgentProspectingBatches(
  ownerUserId: string,
  input: {
    status?: 'draft' | 'researching' | 'review' | 'completed' | 'cancelled';
    page: number;
    pageSize: number;
  },
) {
  const where = and(
    eq(prospectingBatches.ownerUserId, ownerUserId),
    input.status ? eq(prospectingBatches.status, input.status) : undefined,
  );
  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(prospectingBatches)
      .where(where)
      .orderBy(desc(prospectingBatches.updatedAt))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(prospectingBatches)
      .where(where),
  ]);
  return {
    items: rows,
    page: input.page,
    pageSize: input.pageSize,
    total: totals[0]?.count || 0,
  };
}

export async function getAgentProspectingBatch(
  ownerUserId: string,
  batchId: string,
) {
  const [batch] = await db
    .select()
    .from(prospectingBatches)
    .where(
      and(
        eq(prospectingBatches.id, batchId),
        eq(prospectingBatches.ownerUserId, ownerUserId),
      ),
    )
    .limit(1);
  if (!batch)
    throw new AgentApiError(
      'AGENT_PROSPECTING_BATCH_NOT_FOUND',
      'Lote de prospecção não encontrado.',
      404,
    );
  const counts = await db
    .select({
      status: prospectingCandidates.status,
      count: sql<number>`count(*)::int`,
    })
    .from(prospectingCandidates)
    .where(
      and(
        eq(prospectingCandidates.batchId, batchId),
        eq(prospectingCandidates.ownerUserId, ownerUserId),
      ),
    )
    .groupBy(prospectingCandidates.status);
  return {
    ...batch,
    candidateCounts: Object.fromEntries(
      counts.map((row) => [row.status, row.count]),
    ),
  };
}

export async function listAgentProspectingCandidates(
  ownerUserId: string,
  input: {
    batchId: string;
    status?: 'review' | 'approved' | 'ignored' | 'later' | 'promoted';
    page: number;
    pageSize: number;
  },
) {
  const where = and(
    eq(prospectingCandidates.ownerUserId, ownerUserId),
    eq(prospectingCandidates.batchId, input.batchId),
    input.status ? eq(prospectingCandidates.status, input.status) : undefined,
  );
  const [items, totals] = await Promise.all([
    db
      .select()
      .from(prospectingCandidates)
      .where(where)
      .orderBy(
        desc(prospectingCandidates.score),
        desc(prospectingCandidates.updatedAt),
      )
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(prospectingCandidates)
      .where(where),
  ]);
  return {
    items,
    page: input.page,
    pageSize: input.pageSize,
    total: totals[0]?.count || 0,
  };
}
