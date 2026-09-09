import { and, eq, inArray, isNull, lte, lt } from 'drizzle-orm';
import { db } from '@/db';
import {
  automationRuns,
  charges,
  companies,
  domains,
  meetings,
  notifications,
  opportunities,
  proposals,
  projects,
  settings,
  subscriptions,
  tasks,
  users,
} from '@/db/schema';
import {
  DEFAULT_DOMAIN_THRESHOLDS,
  billingPeriod,
  crossedDomainThresholds,
  dateAtNoon,
  differenceInCalendarDays,
  domainTaskKey,
  initialChargeStatus,
  isoDateInTimeZone,
  subscriptionDatesThroughHorizon,
  type SubscriptionFrequency,
} from '@/lib/business';
import {
  domainReminderPriority,
  shouldSurfaceDeferredLead,
} from '@/lib/customer-experience';

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function createAttention(input: {
  ownerUserId: string;
  companyId?: string | null;
  opportunityId?: string | null;
  chargeId?: string | null;
  domainId?: string | null;
  meetingId?: string | null;
  type: string;
  title: string;
  message: string;
  dueAt: Date;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  idempotencyKey: string;
}) {
  const inserted = await db
    .insert(tasks)
    .values({
      ownerUserId: input.ownerUserId,
      companyId: input.companyId || null,
      opportunityId: input.opportunityId || null,
      chargeId: input.chargeId || null,
      domainId: input.domainId || null,
      meetingId: input.meetingId || null,
      type: input.type,
      title: input.title,
      description: input.message,
      dueAt: input.dueAt,
      priority: input.priority,
      source: 'automation',
      idempotencyKey: input.idempotencyKey,
    })
    .onConflictDoNothing()
    .returning({ id: tasks.id });

  await db
    .insert(notifications)
    .values({
      userId: input.ownerUserId,
      type: input.type,
      title: input.title,
      message: input.message,
      entityType: input.domainId
        ? 'domain'
        : input.chargeId
          ? 'charge'
          : input.opportunityId
            ? 'opportunity'
            : input.meetingId
              ? 'meeting'
              : 'company',
      entityId:
        input.domainId ||
        input.chargeId ||
        input.opportunityId ||
        input.meetingId ||
        input.companyId ||
        null,
      idempotencyKey: input.idempotencyKey,
    })
    .onConflictDoNothing();

  return inserted.length;
}

async function processOwner(ownerUserId: string, today: string) {
  let processed = 0;
  const horizon = addDays(today, 30);

  const activeSubscriptions = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.ownerUserId, ownerUserId),
        eq(subscriptions.status, 'active'),
        lte(subscriptions.nextChargeDate, horizon),
      ),
    );

  for (const subscription of activeSubscriptions) {
    const schedule = subscriptionDatesThroughHorizon({
      nextChargeDate: subscription.nextChargeDate,
      horizon,
      frequency: subscription.frequency as SubscriptionFrequency,
      billingDay: subscription.billingDay,
      customIntervalMonths: subscription.customIntervalMonths,
      endDate: subscription.endDate,
    });
    for (const nextDate of schedule.dates) {
      const rows = await db
        .insert(charges)
        .values({
          ownerUserId,
          companyId: subscription.companyId,
          projectId: subscription.projectId,
          subscriptionId: subscription.id,
          description: subscription.description,
          category: 'subscription',
          amount: subscription.amount,
          dueDate: nextDate,
          billingPeriod: billingPeriod(nextDate),
          status: initialChargeStatus(nextDate, today),
        })
        .onConflictDoNothing()
        .returning({ id: charges.id });
      processed += rows.length;
    }
    await db
      .update(subscriptions)
      .set({ nextChargeDate: schedule.nextDate, updatedAt: new Date() })
      .where(
        and(
          eq(subscriptions.id, subscription.id),
          eq(subscriptions.ownerUserId, ownerUserId),
        ),
      );
  }

  const activated = await db
    .update(charges)
    .set({ status: 'pending', updatedAt: new Date() })
    .where(
      and(
        eq(charges.ownerUserId, ownerUserId),
        eq(charges.status, 'scheduled'),
        lte(charges.dueDate, today),
      ),
    )
    .returning({ id: charges.id });
  processed += activated.length;

  const overdue = await db
    .update(charges)
    .set({ status: 'overdue', updatedAt: new Date() })
    .where(
      and(
        eq(charges.ownerUserId, ownerUserId),
        eq(charges.status, 'pending'),
        lt(charges.dueDate, today),
      ),
    )
    .returning();
  processed += overdue.length;
  for (const charge of overdue)
    processed += await createAttention({
      ownerUserId,
      companyId: charge.companyId,
      chargeId: charge.id,
      type: 'charge_overdue',
      title: `Cobrança atrasada: ${charge.description}`,
      message: `Vencimento em ${charge.dueDate}.`,
      dueAt: dateAtNoon(today),
      priority: 'urgent',
      idempotencyKey: `charge:${charge.id}:${charge.dueDate}:overdue`,
    });

  const upcoming = await db
    .select()
    .from(charges)
    .where(
      and(
        eq(charges.ownerUserId, ownerUserId),
        inArray(charges.status, ['scheduled', 'pending']),
        lte(charges.dueDate, addDays(today, 3)),
        isNull(charges.archivedAt),
      ),
    );
  for (const charge of upcoming)
    processed += await createAttention({
      ownerUserId,
      companyId: charge.companyId,
      chargeId: charge.id,
      type: 'charge_due',
      title: `Cobrança próxima: ${charge.description}`,
      message: `Vence em ${charge.dueDate}.`,
      dueAt: dateAtNoon(charge.dueDate),
      priority: 'high',
      idempotencyKey: `charge:${charge.id}:${charge.dueDate}:due`,
    });

  const [ownerSettings] = await db
    .select()
    .from(settings)
    .where(eq(settings.ownerUserId, ownerUserId))
    .limit(1);
  const unscheduledClients = await db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.ownerUserId, ownerUserId),
        eq(companies.lifecycleStatus, 'client'),
        isNull(companies.nextContactAt),
        isNull(companies.archivedAt),
      ),
    );
  if (unscheduledClients.length) {
    const deliveredProjects = await db
      .select({
        companyId: projects.companyId,
        deliveryDate: projects.deliveryDate,
      })
      .from(projects)
      .where(
        and(
          eq(projects.ownerUserId, ownerUserId),
          eq(projects.status, 'delivered'),
          isNull(projects.archivedAt),
        ),
      );
    const latestDelivery = new Map<string, string>();
    for (const project of deliveredProjects) {
      if (!project.deliveryDate) continue;
      const current = latestDelivery.get(project.companyId);
      if (!current || project.deliveryDate > current)
        latestDelivery.set(project.companyId, project.deliveryDate);
    }
    for (const company of unscheduledClients) {
      const deliveredAt = latestDelivery.get(company.id);
      if (!deliveredAt) continue;
      const nextContactAt = dateAtNoon(
        addDays(deliveredAt, ownerSettings?.firstPostSaleDays || 90),
      );
      const updated = await db
        .update(companies)
        .set({ nextContactAt, updatedAt: new Date() })
        .where(
          and(
            eq(companies.id, company.id),
            eq(companies.ownerUserId, ownerUserId),
            isNull(companies.nextContactAt),
          ),
        )
        .returning({ id: companies.id });
      processed += updated.length;
    }
  }
  const thresholds = ownerSettings?.domainAlertDays?.length
    ? ownerSettings.domainAlertDays
    : [...DEFAULT_DOMAIN_THRESHOLDS];
  const domainRows = await db
    .select()
    .from(domains)
    .where(
      and(eq(domains.ownerUserId, ownerUserId), isNull(domains.archivedAt)),
    );
  for (const domain of domainRows) {
    for (const threshold of crossedDomainThresholds(
      domain.expirationDate,
      today,
      thresholds,
    )) {
      const days = differenceInCalendarDays(domain.expirationDate, today);
      const expired = days < 0;
      processed += await createAttention({
        ownerUserId,
        companyId: domain.companyId,
        domainId: domain.id,
        type: 'domain_expiration',
        title: `${expired ? 'Domínio vencido' : 'Renovar domínio'}: ${domain.domain}`,
        message: `${domain.responsibility === 'me' ? 'DOMÍNIO SOB MINHA RESPONSABILIDADE. ' : ''}Vencimento: ${domain.expirationDate}.`,
        dueAt: dateAtNoon(
          domain.expirationDate < today ? today : domain.expirationDate,
        ),
        priority: domainReminderPriority(domain.responsibility, threshold),
        idempotencyKey: domainTaskKey(
          domain.id,
          domain.expirationDate,
          threshold,
        ),
      });
    }
  }

  const followUps = await db
    .select()
    .from(opportunities)
    .where(
      and(
        eq(opportunities.ownerUserId, ownerUserId),
        lte(opportunities.nextActionAt, dateAtNoon(addDays(today, 1))),
        isNull(opportunities.archivedAt),
        isNull(opportunities.wonAt),
        isNull(opportunities.lostAt),
      ),
    );
  for (const opportunity of followUps)
    processed += await createAttention({
      ownerUserId,
      companyId: opportunity.companyId,
      opportunityId: opportunity.id,
      type: 'follow_up',
      title: opportunity.nextAction || `Follow-up: ${opportunity.title}`,
      message: 'Oportunidade com próxima ação vencendo.',
      dueAt: opportunity.nextActionAt || dateAtNoon(today),
      priority: 'high',
      idempotencyKey: `followup:${opportunity.id}:${opportunity.nextActionAt?.toISOString()}`,
    });

  const companyFollowUps = await db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.ownerUserId, ownerUserId),
        eq(companies.prospectingStatus, 'FOLLOWUP_FUTURO'),
        lte(companies.nextActionAt, dateAtNoon(addDays(today, 1))),
        isNull(companies.archivedAt),
      ),
    );
  for (const company of companyFollowUps) {
    if (
      !shouldSurfaceDeferredLead({
        prospectingStatus: company.prospectingStatus,
        nextActionAt: company.nextActionAt,
        until: dateAtNoon(addDays(today, 1)),
      })
    )
      continue;
    processed += await createAttention({
      ownerUserId,
      companyId: company.id,
      type: 'follow_up',
      title: company.nextAction || `Retomar contato: ${company.name}`,
      message: 'Lead marcado para retomar o contato.',
      dueAt: company.nextActionAt || dateAtNoon(today),
      priority: 'high',
      idempotencyKey: `company-followup:${company.id}:${company.nextActionAt?.toISOString()}`,
    });
  }

  const postSaleCompanies = await db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.ownerUserId, ownerUserId),
        eq(companies.lifecycleStatus, 'client'),
        lte(companies.nextContactAt, dateAtNoon(addDays(today, 1))),
        isNull(companies.archivedAt),
      ),
    );
  for (const company of postSaleCompanies)
    processed += await createAttention({
      ownerUserId,
      companyId: company.id,
      type: 'post_sale',
      title: `Pós-venda: ${company.name}`,
      message: 'Hora de retomar o relacionamento com este cliente.',
      dueAt: company.nextContactAt || dateAtNoon(today),
      priority: 'normal',
      idempotencyKey: `post-sale:${company.id}:${company.nextContactAt?.toISOString()}`,
    });

  const staleDate = new Date(dateAtNoon(today).getTime() - 7 * 86_400_000);
  const staleProposals = await db
    .select()
    .from(proposals)
    .where(
      and(
        eq(proposals.ownerUserId, ownerUserId),
        inArray(proposals.status, ['sent', 'negotiation']),
        lte(proposals.sentAt, staleDate),
        isNull(proposals.archivedAt),
      ),
    );
  for (const proposal of staleProposals)
    processed += await createAttention({
      ownerUserId,
      companyId: proposal.companyId,
      type: 'proposal_follow_up',
      title: `Proposta sem retorno: ${proposal.title}`,
      message: 'A proposta está sem atualização há pelo menos sete dias.',
      dueAt: dateAtNoon(today),
      priority: 'high',
      idempotencyKey: `proposal:${proposal.id}:${proposal.sentAt?.toISOString()}:stale`,
    });

  const upcomingMeetings = await db
    .select()
    .from(meetings)
    .where(
      and(
        eq(meetings.ownerUserId, ownerUserId),
        lte(meetings.meetingAt, dateAtNoon(addDays(today, 1))),
        isNull(meetings.archivedAt),
      ),
    );
  for (const meeting of upcomingMeetings)
    processed += await createAttention({
      ownerUserId,
      companyId: meeting.companyId,
      meetingId: meeting.id,
      type: 'meeting',
      title: `Reunião: ${meeting.title}`,
      message: `Agendada para ${meeting.meetingAt.toISOString()}.`,
      dueAt: meeting.meetingAt,
      priority: 'high',
      idempotencyKey: `meeting:${meeting.id}:${meeting.meetingAt.toISOString()}`,
    });

  return processed;
}

export async function runAutomations(ownerUserId?: string) {
  const [run] = await db
    .insert(automationRuns)
    .values({ jobName: ownerUserId ? 'daily-owner' : 'daily-all' })
    .returning();
  let processedCount = 0;
  try {
    const ownerIds = ownerUserId
      ? [ownerUserId]
      : (await db.select({ id: users.id }).from(users)).map((row) => row.id);
    const today = isoDateInTimeZone();
    for (const id of ownerIds) processedCount += await processOwner(id, today);
    await db
      .update(automationRuns)
      .set({ status: 'succeeded', processedCount, finishedAt: new Date() })
      .where(eq(automationRuns.id, run.id));
    return { runId: run.id, processedCount };
  } catch (error) {
    await db
      .update(automationRuns)
      .set({
        status: 'failed',
        processedCount,
        finishedAt: new Date(),
        errorSummary:
          error instanceof Error
            ? error.message.slice(0, 1_000)
            : 'Erro desconhecido',
      })
      .where(eq(automationRuns.id, run.id));
    throw error;
  }
}
