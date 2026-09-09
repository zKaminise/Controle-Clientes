import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { companies, opportunities, users } from '@/db/schema';
import {
  getAgentAttention,
  getAgentCommercialMetrics,
  getAgentFollowUps,
  getAgentLead,
  getAgentLeadScore,
  getAgentLeadStage,
  getAgentOpportunityStage,
  searchAgentLeads,
} from '@/lib/agent-read-service';
import { allowedAgentAdminEmail } from '@/lib/agent-auth';
import { isoDateInTimeZone } from '@/lib/business';

const adminEmail = allowedAgentAdminEmail();
const [owner] = await db
  .select({ id: users.id })
  .from(users)
  .where(sql`lower(${users.email}) = ${adminEmail}`)
  .limit(1);
if (!owner) throw new Error('Conta administrativa autorizada não encontrada.');

const leadSearch = await searchAgentLeads(owner.id, {
  page: 1,
  pageSize: 5,
});
const firstLead = leadSearch.items[0];
if (firstLead) {
  await Promise.all([
    getAgentLead(owner.id, firstLead.id),
    getAgentLeadStage(owner.id, firstLead.id),
    getAgentLeadScore(owner.id, firstLead.id),
  ]);
}

const [firstOpportunity] = await db
  .select({ id: opportunities.id })
  .from(opportunities)
  .innerJoin(companies, eq(opportunities.companyId, companies.id))
  .where(eq(opportunities.ownerUserId, owner.id))
  .limit(1);
let opportunityStageQuery = 'success';
if (firstOpportunity) {
  await getAgentOpportunityStage(owner.id, firstOpportunity.id);
} else {
  try {
    await getAgentOpportunityStage(
      owner.id,
      '00000000-0000-4000-8000-000000000000',
    );
    throw new Error('A consulta deveria retornar não encontrado.');
  } catch (error) {
    if (
      !(error instanceof Error) ||
      error.message !== 'Oportunidade não encontrada.'
    )
      throw error;
    opportunityStageQuery = 'not_found_verified';
  }
}

const today = isoDateInTimeZone();
const [followUps, attention, metrics] = await Promise.all([
  getAgentFollowUps(owner.id, { limit: 5 }),
  getAgentAttention(owner.id, { limit: 5 }),
  getAgentCommercialMetrics(owner.id, {
    from: `${today.slice(0, 8)}01`,
    to: today,
    timezone: 'America/Sao_Paulo',
    comparePrevious: true,
  }),
]);

console.log(
  JSON.stringify(
    {
      ok: true,
      leadSearchItems: leadSearch.items.length,
      leadSearchTotal: leadSearch.pagination.total,
      individualLeadQueries: Boolean(firstLead),
      opportunityStageQuery,
      followUpGroups: Object.keys(followUps),
      attentionItems: attention.items.length,
      metricsPeriod: metrics.period,
    },
    null,
    2,
  ),
);
