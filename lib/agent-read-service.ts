import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  lte,
  notExists,
  notInArray,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '@/db';
import {
  activities,
  charges,
  companies,
  digitalAnalyses,
  domains,
  interactions,
  meetings,
  opportunities,
  pipelineStages,
  projects,
  proposals,
  referrals,
  tasks,
} from '@/db/schema';
import {
  APP_TIMEZONE,
  addCalendarDays,
  localDateStartUtc,
  zonedDateRange,
  zonedDayRange,
} from '@/lib/business';
import { getTodayFollowUps } from '@/lib/crm-service';
import {
  agentAttentionQuerySchema,
  agentLeadSearchSchema,
  agentMetricsQuerySchema,
} from '@/lib/agent-validation';

type LeadSearch = z.infer<typeof agentLeadSearchSchema>;
type AttentionQuery = z.infer<typeof agentAttentionQuerySchema>;
type MetricsQuery = z.infer<typeof agentMetricsQuerySchema>;

const companySummaryFields = {
  id: companies.id,
  name: companies.name,
  tradeName: companies.tradeName,
  website: companies.website,
  instagram: companies.instagram,
  email: companies.email,
  phone: companies.phone,
  whatsapp: companies.whatsapp,
  city: companies.city,
  state: companies.state,
  industry: companies.industry,
  lifecycleStatus: companies.lifecycleStatus,
  prospectingStatus: companies.prospectingStatus,
  leadSource: companies.leadSource,
  nextAction: companies.nextAction,
  nextActionAt: companies.nextActionAt,
  createdAt: companies.createdAt,
  updatedAt: companies.updatedAt,
};

const analysisSummaryFields = {
  id: digitalAnalyses.id,
  siteStatus: digitalAnalyses.siteStatus,
  priority: digitalAnalyses.priority,
  leadScore: digitalAnalyses.leadScore,
  scoreLevel: digitalAnalyses.scoreLevel,
  analyzedAt: digitalAnalyses.analyzedAt,
};

function leadConditions(ownerUserId: string, input: LeadSearch) {
  const conditions: SQL[] = [
    eq(companies.ownerUserId, ownerUserId),
    isNull(companies.archivedAt),
  ];
  if (input.query) {
    const pattern = `%${input.query}%`;
    conditions.push(
      or(
        ilike(companies.name, pattern),
        ilike(companies.tradeName, pattern),
        ilike(companies.industry, pattern),
        ilike(companies.city, pattern),
        ilike(companies.email, pattern),
        ilike(companies.phone, pattern),
        ilike(companies.whatsapp, pattern),
        ilike(companies.website, pattern),
      )!,
    );
  }
  if (input.industry)
    conditions.push(ilike(companies.industry, `%${input.industry}%`));
  if (input.city) conditions.push(ilike(companies.city, `%${input.city}%`));
  if (input.state) conditions.push(eq(companies.state, input.state));
  if (input.lifecycleStatus)
    conditions.push(eq(companies.lifecycleStatus, input.lifecycleStatus));
  if (input.prospectingStatus)
    conditions.push(eq(companies.prospectingStatus, input.prospectingStatus));
  if (input.siteStatus)
    conditions.push(eq(digitalAnalyses.siteStatus, input.siteStatus));
  if (input.priority)
    conditions.push(
      or(
        eq(digitalAnalyses.priority, input.priority),
        eq(digitalAnalyses.scoreLevel, input.priority),
      )!,
    );
  return conditions;
}

export async function searchAgentLeads(ownerUserId: string, input: LeadSearch) {
  const where = and(...leadConditions(ownerUserId, input));
  const [rows, totals] = await Promise.all([
    db
      .select({
        company: companySummaryFields,
        digitalAnalysis: analysisSummaryFields,
      })
      .from(companies)
      .leftJoin(
        digitalAnalyses,
        and(
          eq(digitalAnalyses.companyId, companies.id),
          eq(digitalAnalyses.ownerUserId, ownerUserId),
        ),
      )
      .where(where)
      .orderBy(desc(companies.updatedAt))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
    db
      .select({ total: count() })
      .from(companies)
      .leftJoin(
        digitalAnalyses,
        and(
          eq(digitalAnalyses.companyId, companies.id),
          eq(digitalAnalyses.ownerUserId, ownerUserId),
        ),
      )
      .where(where),
  ]);
  const companyIds = rows.map((row) => row.company.id);
  const lastInteractions = companyIds.length
    ? await db
        .selectDistinctOn([interactions.companyId], {
          id: interactions.id,
          companyId: interactions.companyId,
          type: interactions.type,
          subject: interactions.subject,
          result: interactions.result,
          occurredAt: interactions.occurredAt,
        })
        .from(interactions)
        .where(
          and(
            eq(interactions.ownerUserId, ownerUserId),
            inArray(interactions.companyId, companyIds),
          ),
        )
        .orderBy(interactions.companyId, desc(interactions.occurredAt))
    : [];
  const interactionByCompany = new Map(
    lastInteractions.map((row) => [row.companyId, row]),
  );
  const total = Number(totals[0]?.total || 0);
  return {
    items: rows.map((row) => ({
      ...row.company,
      digitalAnalysis: row.digitalAnalysis?.id ? row.digitalAnalysis : null,
      lastInteraction: interactionByCompany.get(row.company.id) || null,
    })),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total,
      pages: Math.ceil(total / input.pageSize),
    },
  };
}

export async function getAgentLead(ownerUserId: string, companyId: string) {
  const [company] = await db
    .select(companySummaryFields)
    .from(companies)
    .where(
      and(
        eq(companies.id, companyId),
        eq(companies.ownerUserId, ownerUserId),
        isNull(companies.archivedAt),
      ),
    )
    .limit(1);
  if (!company) throw new Error('Lead não encontrado.');

  const [
    analysisRows,
    interactionRows,
    taskRows,
    opportunityRows,
    referralRows,
  ] = await Promise.all([
    db
      .select({
        ...analysisSummaryFields,
        hasSite: digitalAnalyses.hasSite,
        websiteUrl: digitalAnalyses.websiteUrl,
        issues: digitalAnalyses.issues,
        opportunities: digitalAnalyses.opportunities,
        scoreBreakdown: digitalAnalyses.scoreBreakdown,
      })
      .from(digitalAnalyses)
      .where(
        and(
          eq(digitalAnalyses.ownerUserId, ownerUserId),
          eq(digitalAnalyses.companyId, companyId),
        ),
      )
      .limit(1),
    db
      .select({
        id: interactions.id,
        type: interactions.type,
        subject: interactions.subject,
        content: interactions.content,
        result: interactions.result,
        notes: interactions.notes,
        occurredAt: interactions.occurredAt,
        nextAction: interactions.nextAction,
        nextActionAt: interactions.nextActionAt,
      })
      .from(interactions)
      .where(
        and(
          eq(interactions.ownerUserId, ownerUserId),
          eq(interactions.companyId, companyId),
        ),
      )
      .orderBy(desc(interactions.occurredAt))
      .limit(20),
    db
      .select({
        id: tasks.id,
        type: tasks.type,
        title: tasks.title,
        reason: tasks.reason,
        priority: tasks.priority,
        status: tasks.status,
        dueAt: tasks.dueAt,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.ownerUserId, ownerUserId),
          eq(tasks.companyId, companyId),
          inArray(tasks.status, ['open', 'snoozed']),
        ),
      )
      .orderBy(tasks.dueAt)
      .limit(20),
    db
      .select({
        id: opportunities.id,
        title: opportunities.title,
        estimatedValue: opportunities.estimatedValue,
        probability: opportunities.probability,
        nextAction: opportunities.nextAction,
        nextActionAt: opportunities.nextActionAt,
        stage: {
          id: pipelineStages.id,
          name: pipelineStages.name,
          slug: pipelineStages.slug,
          isWon: pipelineStages.isWon,
          isLost: pipelineStages.isLost,
        },
      })
      .from(opportunities)
      .innerJoin(
        pipelineStages,
        and(
          eq(opportunities.pipelineStageId, pipelineStages.id),
          eq(pipelineStages.ownerUserId, ownerUserId),
        ),
      )
      .where(
        and(
          eq(opportunities.ownerUserId, ownerUserId),
          eq(opportunities.companyId, companyId),
          isNull(opportunities.archivedAt),
        ),
      ),
    db
      .select({
        id: referrals.id,
        referrerCompanyId: referrals.referrerCompanyId,
        referredCompanyId: referrals.referredCompanyId,
        status: referrals.status,
        notes: referrals.notes,
        convertedAt: referrals.convertedAt,
        createdAt: referrals.createdAt,
      })
      .from(referrals)
      .where(
        and(
          eq(referrals.ownerUserId, ownerUserId),
          or(
            eq(referrals.referrerCompanyId, companyId),
            eq(referrals.referredCompanyId, companyId),
          ),
        ),
      )
      .orderBy(desc(referrals.createdAt)),
  ]);

  return {
    company,
    digitalAnalysis: analysisRows[0] || null,
    recentInteractions: interactionRows,
    openFollowUps: taskRows,
    opportunities: opportunityRows,
    referrals: referralRows,
  };
}

export async function getAgentLeadStage(
  ownerUserId: string,
  companyId: string,
) {
  const [row] = await db
    .select({
      leadId: companies.id,
      leadName: companies.name,
      prospectingStatus: companies.prospectingStatus,
      updatedAt: companies.updatedAt,
    })
    .from(companies)
    .where(
      and(
        eq(companies.id, companyId),
        eq(companies.ownerUserId, ownerUserId),
        isNull(companies.archivedAt),
      ),
    )
    .limit(1);
  if (!row) throw new Error('Lead não encontrado.');
  return row;
}

export async function getAgentOpportunityStage(
  ownerUserId: string,
  opportunityId: string,
) {
  const [row] = await db
    .select({
      opportunityId: opportunities.id,
      opportunityTitle: opportunities.title,
      companyId: opportunities.companyId,
      companyName: companies.name,
      stage: {
        id: pipelineStages.id,
        name: pipelineStages.name,
        slug: pipelineStages.slug,
        position: pipelineStages.position,
        isWon: pipelineStages.isWon,
        isLost: pipelineStages.isLost,
      },
      updatedAt: opportunities.updatedAt,
    })
    .from(opportunities)
    .innerJoin(
      companies,
      and(
        eq(opportunities.companyId, companies.id),
        eq(companies.ownerUserId, ownerUserId),
      ),
    )
    .innerJoin(
      pipelineStages,
      and(
        eq(opportunities.pipelineStageId, pipelineStages.id),
        eq(pipelineStages.ownerUserId, ownerUserId),
      ),
    )
    .where(
      and(
        eq(opportunities.id, opportunityId),
        eq(opportunities.ownerUserId, ownerUserId),
        isNull(opportunities.archivedAt),
      ),
    )
    .limit(1);
  if (!row) throw new Error('Oportunidade não encontrada.');
  return row;
}

function taskSummary(
  task: Awaited<ReturnType<typeof getTodayFollowUps>>['today'][number],
  companyNames: Map<string, string>,
) {
  return {
    id: task.id,
    companyId: task.companyId,
    companyName: task.companyId
      ? companyNames.get(task.companyId) || null
      : null,
    type: task.type,
    title: task.title,
    reason: task.reason,
    priority: task.priority,
    status: task.status,
    dueAt: task.dueAt,
    reminderAt: task.reminderAt,
  };
}

export async function getAgentFollowUps(
  ownerUserId: string,
  input: { bucket?: string; limit: number },
  now = new Date(),
) {
  const groups = await getTodayFollowUps(ownerUserId, now, APP_TIMEZONE);
  const tasksToName = [...groups.overdue, ...groups.today, ...groups.upcoming];
  const companyIds = [
    ...new Set(
      tasksToName
        .map((task) => task.companyId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const companyRows = companyIds.length
    ? await db
        .select({ id: companies.id, name: companies.name })
        .from(companies)
        .where(
          and(
            eq(companies.ownerUserId, ownerUserId),
            inArray(companies.id, companyIds),
          ),
        )
    : [];
  const names = new Map(companyRows.map((row) => [row.id, row.name]));
  const limit = input.limit;
  const result = {
    timezone: APP_TIMEZONE,
    date: zonedDayRange(now, APP_TIMEZONE).date,
    overdue: groups.overdue
      .slice(0, limit)
      .map((task) => taskSummary(task, names)),
    today: groups.today.slice(0, limit).map((task) => taskSummary(task, names)),
    upcoming: groups.upcoming
      .slice(0, limit)
      .map((task) => taskSummary(task, names)),
    leadsWithoutAction: groups.leadsWithoutAction
      .slice(0, limit)
      .map((lead) => ({
        id: lead.id,
        name: lead.name,
        tradeName: lead.tradeName,
        industry: lead.industry,
        city: lead.city,
        state: lead.state,
        prospectingStatus: lead.prospectingStatus,
        createdAt: lead.createdAt,
      })),
  };
  if (!input.bucket) return result;
  const key =
    input.bucket === 'without_action'
      ? 'leadsWithoutAction'
      : (input.bucket as 'overdue' | 'today' | 'upcoming');
  return {
    timezone: result.timezone,
    date: result.date,
    [key]: result[key],
  };
}

export async function getAgentLeadScore(
  ownerUserId: string,
  companyId: string,
) {
  const [row] = await db
    .select({
      leadId: companies.id,
      leadName: companies.name,
      leadScore: digitalAnalyses.leadScore,
      scoreLevel: digitalAnalyses.scoreLevel,
      priority: digitalAnalyses.priority,
      scoreBreakdown: digitalAnalyses.scoreBreakdown,
      analyzedAt: digitalAnalyses.analyzedAt,
    })
    .from(companies)
    .leftJoin(
      digitalAnalyses,
      and(
        eq(digitalAnalyses.companyId, companies.id),
        eq(digitalAnalyses.ownerUserId, ownerUserId),
      ),
    )
    .where(
      and(
        eq(companies.id, companyId),
        eq(companies.ownerUserId, ownerUserId),
        isNull(companies.archivedAt),
      ),
    )
    .limit(1);
  if (!row) throw new Error('Lead não encontrado.');
  return row;
}

type AttentionItem = {
  id: string;
  entityId: string;
  type: 'task' | 'charge' | 'domain' | 'meeting' | 'lead_without_action';
  category: string | null;
  title: string;
  companyId: string | null;
  companyName: string | null;
  dueAt: Date | string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
};

const attentionPriority = { urgent: 4, high: 3, normal: 2, low: 1 } as const;

export async function getAgentAttention(
  ownerUserId: string,
  input: AttentionQuery,
  now = new Date(),
) {
  const day = zonedDayRange(now, APP_TIMEZONE);
  const periodStart = input.from
    ? localDateStartUtc(input.from, APP_TIMEZONE)
    : null;
  const periodEnd = input.to
    ? localDateStartUtc(addCalendarDays(input.to, 1), APP_TIMEZONE)
    : null;
  const wants = (type: AttentionItem['type']) =>
    !input.type || input.type === type;
  const timestampRange = (column: typeof tasks.dueAt) => [
    ...(periodStart ? [gte(column, periodStart)] : []),
    ...(periodEnd ? [lt(column, periodEnd)] : []),
  ];
  const dateFrom = input.from || day.date;
  const dateTo = input.to || addCalendarDays(dateFrom, 60);
  const urgentDomainThrough = addCalendarDays(day.date, 7);
  const domainDateFrom =
    input.priority === 'high' && dateFrom <= urgentDomainThrough
      ? addCalendarDays(urgentDomainThrough, 1)
      : dateFrom;
  const domainDateTo =
    input.priority === 'urgent' && dateTo > urgentDomainThrough
      ? urgentDomainThrough
      : dateTo;
  const meetingStart = periodStart || now;
  const meetingEnd =
    periodEnd || new Date(meetingStart.getTime() + 7 * 86_400_000);

  const [taskRows, chargeRows, domainRows, meetingRows, leadRows] =
    await Promise.all([
      wants('task')
        ? db
            .select({
              id: tasks.id,
              category: tasks.type,
              title: tasks.title,
              companyId: tasks.companyId,
              companyName: companies.name,
              dueAt: tasks.dueAt,
              priority: tasks.priority,
            })
            .from(tasks)
            .leftJoin(
              companies,
              and(
                eq(tasks.companyId, companies.id),
                eq(companies.ownerUserId, ownerUserId),
              ),
            )
            .where(
              and(
                eq(tasks.ownerUserId, ownerUserId),
                inArray(tasks.status, ['open', 'snoozed']),
                input.priority ? eq(tasks.priority, input.priority) : undefined,
                ...timestampRange(tasks.dueAt),
              ),
            )
            .orderBy(tasks.dueAt)
            .limit(input.limit)
        : Promise.resolve([]),
      wants('charge') && (!input.priority || input.priority === 'urgent')
        ? db
            .select({
              id: charges.id,
              title: charges.description,
              companyId: charges.companyId,
              companyName: companies.name,
              dueAt: charges.dueDate,
            })
            .from(charges)
            .innerJoin(
              companies,
              and(
                eq(charges.companyId, companies.id),
                eq(companies.ownerUserId, ownerUserId),
              ),
            )
            .where(
              and(
                eq(charges.ownerUserId, ownerUserId),
                eq(charges.status, 'overdue'),
                input.from ? gte(charges.dueDate, input.from) : undefined,
                input.to ? lte(charges.dueDate, input.to) : undefined,
              ),
            )
            .orderBy(charges.dueDate)
            .limit(input.limit)
        : Promise.resolve([]),
      wants('domain') &&
      (!input.priority || ['urgent', 'high'].includes(input.priority))
        ? db
            .select({
              id: domains.id,
              title: domains.domain,
              companyId: domains.companyId,
              companyName: companies.name,
              dueAt: domains.expirationDate,
            })
            .from(domains)
            .innerJoin(
              companies,
              and(
                eq(domains.companyId, companies.id),
                eq(companies.ownerUserId, ownerUserId),
              ),
            )
            .where(
              and(
                eq(domains.ownerUserId, ownerUserId),
                isNull(domains.archivedAt),
                gte(domains.expirationDate, domainDateFrom),
                lte(domains.expirationDate, domainDateTo),
              ),
            )
            .orderBy(domains.expirationDate)
            .limit(input.limit)
        : Promise.resolve([]),
      wants('meeting') && (!input.priority || input.priority === 'high')
        ? db
            .select({
              id: meetings.id,
              title: meetings.title,
              companyId: meetings.companyId,
              companyName: companies.name,
              dueAt: meetings.meetingAt,
            })
            .from(meetings)
            .innerJoin(
              companies,
              and(
                eq(meetings.companyId, companies.id),
                eq(companies.ownerUserId, ownerUserId),
              ),
            )
            .where(
              and(
                eq(meetings.ownerUserId, ownerUserId),
                isNull(meetings.archivedAt),
                gte(meetings.meetingAt, meetingStart),
                lt(meetings.meetingAt, meetingEnd),
              ),
            )
            .orderBy(meetings.meetingAt)
            .limit(input.limit)
        : Promise.resolve([]),
      wants('lead_without_action') &&
      !input.from &&
      !input.to &&
      (!input.priority || input.priority === 'normal')
        ? db
            .select({
              id: companies.id,
              title: companies.name,
              companyId: companies.id,
              companyName: companies.name,
              createdAt: companies.createdAt,
            })
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
            )
            .orderBy(companies.createdAt)
            .limit(input.limit)
        : Promise.resolve([]),
    ]);

  const items: AttentionItem[] = [
    ...taskRows.map((row) => ({
      ...row,
      entityId: row.id,
      id: `task-${row.id}`,
      type: 'task' as const,
    })),
    ...chargeRows.map((row) => ({
      ...row,
      entityId: row.id,
      id: `charge-${row.id}`,
      type: 'charge' as const,
      category: 'overdue',
      priority: 'urgent' as const,
    })),
    ...domainRows.map((row) => ({
      ...row,
      entityId: row.id,
      id: `domain-${row.id}`,
      type: 'domain' as const,
      category: 'expiration',
      priority:
        row.dueAt <= addCalendarDays(day.date, 7)
          ? ('urgent' as const)
          : ('high' as const),
    })),
    ...meetingRows.map((row) => ({
      ...row,
      entityId: row.id,
      id: `meeting-${row.id}`,
      type: 'meeting' as const,
      category: 'upcoming',
      priority: 'high' as const,
    })),
    ...leadRows.map((row) => ({
      id: `lead-${row.id}`,
      entityId: row.id,
      type: 'lead_without_action' as const,
      category: 'no_action',
      title: row.title,
      companyId: row.companyId,
      companyName: row.companyName,
      dueAt: null,
      priority: 'normal' as const,
    })),
  ].filter((item) => !input.priority || item.priority === input.priority);
  items.sort(
    (left, right) =>
      attentionPriority[right.priority] - attentionPriority[left.priority] ||
      (left.dueAt ? new Date(left.dueAt).getTime() : Number.MAX_SAFE_INTEGER) -
        (right.dueAt
          ? new Date(right.dueAt).getTime()
          : Number.MAX_SAFE_INTEGER),
  );
  return {
    timezone: APP_TIMEZONE,
    generatedAt: now,
    items: items.slice(0, input.limit),
    total: items.length,
    truncated: items.length > input.limit,
  };
}

type CommercialMetrics = {
  newLeads: number;
  contacts: number;
  noResponse: number;
  interested: number;
  meetings: number;
  proposals: number;
  negotiations: number;
  closedClients: number;
  conversionRate: number;
  projectRevenue: number;
};

async function countProspectingTransitions(
  ownerUserId: string,
  statuses: string[],
  start: Date,
  end: Date,
) {
  const [row] = await db
    .select({ total: countDistinct(activities.companyId) })
    .from(activities)
    .where(
      and(
        eq(activities.ownerUserId, ownerUserId),
        eq(activities.entityType, 'companies'),
        eq(activities.action, 'updated'),
        gte(activities.createdAt, start),
        lt(activities.createdAt, end),
        or(
          ...statuses.map(
            (status) =>
              sql`${activities.metadata}->>'prospectingStatus' = ${status}`,
          ),
        ),
      ),
    );
  return Number(row?.total || 0);
}

async function commercialMetricsForPeriod(
  ownerUserId: string,
  from: string,
  to: string,
): Promise<CommercialMetrics> {
  const range = zonedDateRange(from, to, APP_TIMEZONE);
  const [
    newLeadRows,
    contactRows,
    noResponse,
    interested,
    meetingRows,
    proposalRows,
    negotiations,
    closedClients,
    terminalOutcomes,
    revenueRows,
  ] = await Promise.all([
    db
      .select({ total: count() })
      .from(companies)
      .where(
        and(
          eq(companies.ownerUserId, ownerUserId),
          gte(companies.createdAt, range.start),
          lt(companies.createdAt, range.end),
        ),
      ),
    db
      .select({ total: count() })
      .from(interactions)
      .where(
        and(
          eq(interactions.ownerUserId, ownerUserId),
          notInArray(interactions.type, ['note', 'system']),
          gte(interactions.occurredAt, range.start),
          lt(interactions.occurredAt, range.end),
        ),
      ),
    countProspectingTransitions(
      ownerUserId,
      ['SEM_RESPOSTA'],
      range.start,
      range.end,
    ),
    countProspectingTransitions(
      ownerUserId,
      ['INTERESSADO'],
      range.start,
      range.end,
    ),
    db
      .select({ total: count() })
      .from(meetings)
      .where(
        and(
          eq(meetings.ownerUserId, ownerUserId),
          gte(meetings.meetingAt, range.start),
          lt(meetings.meetingAt, range.end),
        ),
      ),
    db
      .select({ total: count() })
      .from(proposals)
      .where(
        and(
          eq(proposals.ownerUserId, ownerUserId),
          inArray(proposals.status, ['sent', 'negotiation', 'accepted']),
          gte(proposals.sentAt, range.start),
          lt(proposals.sentAt, range.end),
        ),
      ),
    countProspectingTransitions(
      ownerUserId,
      ['NEGOCIACAO'],
      range.start,
      range.end,
    ),
    countProspectingTransitions(
      ownerUserId,
      ['FECHADO'],
      range.start,
      range.end,
    ),
    countProspectingTransitions(
      ownerUserId,
      ['FECHADO', 'PERDIDO', 'SEM_INTERESSE', 'DESCARTADO'],
      range.start,
      range.end,
    ),
    db
      .select({ total: sql<string>`coalesce(sum(${projects.soldValue}), 0)` })
      .from(projects)
      .where(
        and(
          eq(projects.ownerUserId, ownerUserId),
          gte(projects.createdAt, range.start),
          lt(projects.createdAt, range.end),
        ),
      ),
  ]);
  const closed = Number(closedClients || 0);
  const terminal = Number(terminalOutcomes || 0);
  return {
    newLeads: Number(newLeadRows[0]?.total || 0),
    contacts: Number(contactRows[0]?.total || 0),
    noResponse: Number(noResponse || 0),
    interested: Number(interested || 0),
    meetings: Number(meetingRows[0]?.total || 0),
    proposals: Number(proposalRows[0]?.total || 0),
    negotiations: Number(negotiations || 0),
    closedClients: closed,
    conversionRate: terminal
      ? Math.round((closed / terminal) * 10_000) / 100
      : 0,
    projectRevenue: Number(revenueRows[0]?.total || 0),
  };
}

function metricComparison(
  current: CommercialMetrics,
  previous: CommercialMetrics,
) {
  return Object.fromEntries(
    Object.entries(current).map(([key, value]) => {
      const previousValue = previous[key as keyof CommercialMetrics];
      const percentChange =
        previousValue === 0
          ? value === 0
            ? 0
            : null
          : Math.round(((value - previousValue) / previousValue) * 10_000) /
            100;
      return [key, { current: value, previous: previousValue, percentChange }];
    }),
  );
}

export async function getAgentCommercialMetrics(
  ownerUserId: string,
  input: MetricsQuery,
) {
  const current = await commercialMetricsForPeriod(
    ownerUserId,
    input.from,
    input.to,
  );
  if (!input.comparePrevious) {
    return {
      period: { from: input.from, to: input.to, timezone: APP_TIMEZONE },
      metrics: current,
      comparison: null,
    };
  }
  const days =
    Math.round(
      (Date.parse(`${input.to}T12:00:00Z`) -
        Date.parse(`${input.from}T12:00:00Z`)) /
        86_400_000,
    ) + 1;
  const previousTo = addCalendarDays(input.from, -1);
  const previousFrom = addCalendarDays(input.from, -days);
  const previous = await commercialMetricsForPeriod(
    ownerUserId,
    previousFrom,
    previousTo,
  );
  return {
    period: { from: input.from, to: input.to, timezone: APP_TIMEZONE },
    metrics: current,
    comparison: {
      period: {
        from: previousFrom,
        to: previousTo,
        timezone: APP_TIMEZONE,
      },
      metrics: previous,
      changes: metricComparison(current, previous),
    },
  };
}
