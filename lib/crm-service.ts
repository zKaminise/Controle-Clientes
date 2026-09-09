import { and, desc, eq, inArray, isNull, notExists } from 'drizzle-orm';
import { db } from '@/db';
import {
  companies,
  digitalAnalyses,
  interactions,
  opportunities,
  pipelineHistory,
  pipelineStages,
  referrals,
  tasks,
} from '@/db/schema';
import { APP_TIMEZONE, zonedDayRange } from '@/lib/business';

export type LeadFilters = {
  query?: string;
  industry?: string;
  city?: string;
  state?: string;
  lifecycleStatus?: string;
  prospectingStatus?: string;
  siteStatus?: string;
  priority?: string;
  contactedBefore?: string;
  noAction?: boolean;
  proposalPending?: boolean;
  page?: number;
  pageSize?: number;
};

function includes(value: string | null | undefined, query: string) {
  return (
    value
      ?.toLocaleLowerCase('pt-BR')
      .includes(query.toLocaleLowerCase('pt-BR')) || false
  );
}

export async function listLeads(
  ownerUserId: string,
  filters: LeadFilters = {},
) {
  const [
    companyRows,
    analysisRows,
    interactionRows,
    opportunityRows,
    stageRows,
  ] = await Promise.all([
    db
      .select()
      .from(companies)
      .where(
        and(
          eq(companies.ownerUserId, ownerUserId),
          isNull(companies.archivedAt),
        ),
      )
      .orderBy(desc(companies.updatedAt)),
    db
      .select()
      .from(digitalAnalyses)
      .where(eq(digitalAnalyses.ownerUserId, ownerUserId)),
    db
      .select()
      .from(interactions)
      .where(eq(interactions.ownerUserId, ownerUserId))
      .orderBy(desc(interactions.occurredAt)),
    db
      .select()
      .from(opportunities)
      .where(
        and(
          eq(opportunities.ownerUserId, ownerUserId),
          isNull(opportunities.archivedAt),
        ),
      ),
    db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.ownerUserId, ownerUserId)),
  ]);
  const analyses = new Map(analysisRows.map((row) => [row.companyId, row]));
  const lastInteractions = new Map<string, (typeof interactionRows)[number]>();
  for (const row of interactionRows)
    if (!lastInteractions.has(row.companyId))
      lastInteractions.set(row.companyId, row);
  const stages = new Map(stageRows.map((row) => [row.id, row]));
  const filtered = companyRows.filter((company) => {
    const analysis = analyses.get(company.id);
    const lastInteraction = lastInteractions.get(company.id);
    const companyOpportunities = opportunityRows.filter(
      (row) => row.companyId === company.id,
    );
    const queryMatch =
      !filters.query ||
      [
        company.name,
        company.tradeName,
        company.industry,
        company.city,
        company.email,
        company.phone,
        company.whatsapp,
        company.website,
      ].some((value) => includes(value, filters.query!));
    const proposalPending = companyOpportunities.some((opportunity) => {
      const stage = stages.get(opportunity.pipelineStageId);
      return Boolean(
        stage &&
        ['proposal', 'proposta_enviada', 'negotiation', 'negociacao'].includes(
          stage.slug,
        ) &&
        !stage.isWon &&
        !stage.isLost,
      );
    });
    return (
      queryMatch &&
      (!filters.industry || includes(company.industry, filters.industry)) &&
      (!filters.city || includes(company.city, filters.city)) &&
      (!filters.state || company.state === filters.state.toUpperCase()) &&
      (!filters.lifecycleStatus ||
        company.lifecycleStatus === filters.lifecycleStatus) &&
      (!filters.prospectingStatus ||
        company.prospectingStatus === filters.prospectingStatus) &&
      (!filters.siteStatus || analysis?.siteStatus === filters.siteStatus) &&
      (!filters.priority ||
        analysis?.priority === filters.priority ||
        analysis?.scoreLevel === filters.priority) &&
      (!filters.contactedBefore ||
        Boolean(
          lastInteraction &&
          lastInteraction.occurredAt < new Date(filters.contactedBefore),
        )) &&
      (!filters.noAction ||
        (!lastInteraction &&
          !company.nextActionAt &&
          !company.nextContactAt)) &&
      (!filters.proposalPending || proposalPending)
    );
  });
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 25));
  const page = Math.max(1, filters.page || 1);
  return {
    items: filtered
      .slice((page - 1) * pageSize, page * pageSize)
      .map((company) => ({
        ...company,
        digitalAnalysis: analyses.get(company.id) || null,
        lastInteraction: lastInteractions.get(company.id) || null,
      })),
    pagination: {
      page,
      pageSize,
      total: filtered.length,
      pages: Math.ceil(filtered.length / pageSize),
    },
  };
}

export async function getLeadDetails(ownerUserId: string, companyId: string) {
  const [
    companyRows,
    analysisRows,
    interactionRows,
    taskRows,
    opportunityRows,
    referralRows,
    historyRows,
  ] = await Promise.all([
    db
      .select()
      .from(companies)
      .where(
        and(
          eq(companies.id, companyId),
          eq(companies.ownerUserId, ownerUserId),
          isNull(companies.archivedAt),
        ),
      )
      .limit(1),
    db
      .select()
      .from(digitalAnalyses)
      .where(
        and(
          eq(digitalAnalyses.companyId, companyId),
          eq(digitalAnalyses.ownerUserId, ownerUserId),
        ),
      )
      .limit(1),
    db
      .select()
      .from(interactions)
      .where(
        and(
          eq(interactions.companyId, companyId),
          eq(interactions.ownerUserId, ownerUserId),
        ),
      )
      .orderBy(desc(interactions.occurredAt)),
    db
      .select()
      .from(tasks)
      .where(
        and(eq(tasks.companyId, companyId), eq(tasks.ownerUserId, ownerUserId)),
      )
      .orderBy(tasks.dueAt),
    db
      .select()
      .from(opportunities)
      .where(
        and(
          eq(opportunities.companyId, companyId),
          eq(opportunities.ownerUserId, ownerUserId),
          isNull(opportunities.archivedAt),
        ),
      ),
    db
      .select()
      .from(referrals)
      .where(eq(referrals.ownerUserId, ownerUserId))
      .orderBy(desc(referrals.createdAt)),
    db
      .select()
      .from(pipelineHistory)
      .where(
        and(
          eq(pipelineHistory.companyId, companyId),
          eq(pipelineHistory.ownerUserId, ownerUserId),
        ),
      )
      .orderBy(desc(pipelineHistory.changedAt)),
  ]);
  const company = companyRows[0];
  if (!company) throw new Error('Lead não encontrado.');
  return {
    company,
    digitalAnalysis: analysisRows[0] || null,
    interactions: interactionRows,
    tasks: taskRows,
    opportunities: opportunityRows,
    referrals: referralRows.filter(
      (row) =>
        row.referrerCompanyId === companyId ||
        row.referredCompanyId === companyId,
    ),
    pipelineHistory: historyRows,
  };
}

export async function getTodayFollowUps(
  ownerUserId: string,
  now = new Date(),
  timeZone = APP_TIMEZONE,
) {
  const [taskRows, companyRows] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.ownerUserId, ownerUserId),
          inArray(tasks.status, ['open', 'snoozed']),
        ),
      )
      .orderBy(tasks.dueAt),
    db
      .select()
      .from(companies)
      .where(
        and(
          eq(companies.ownerUserId, ownerUserId),
          isNull(companies.archivedAt),
          isNull(companies.nextActionAt),
          isNull(companies.nextContactAt),
          notExists(
            db
              .select({ id: interactions.id })
              .from(interactions)
              .where(
                and(
                  eq(interactions.ownerUserId, ownerUserId),
                  eq(interactions.companyId, companies.id),
                ),
              ),
          ),
        ),
      ),
  ]);
  const { start, end } = zonedDayRange(now, timeZone);
  return {
    overdue: taskRows.filter((task) => task.dueAt < start),
    today: taskRows.filter((task) => task.dueAt >= start && task.dueAt < end),
    upcoming: taskRows.filter((task) => task.dueAt >= end),
    leadsWithoutAction: companyRows,
  };
}
