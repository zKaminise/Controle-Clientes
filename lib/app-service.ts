import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  activities,
  charges,
  companies,
  companyTags,
  contacts,
  domains,
  emailServices,
  hostingServices,
  interactions,
  meetings,
  messageLogs,
  messageTemplates,
  notifications,
  opportunities,
  payments,
  pipelineStages,
  projects,
  proposals,
  services,
  settings,
  subscriptions,
  tags,
  tasks,
} from '@/db/schema';
import {
  dateAtNoon,
  nextPostSaleDate,
  paymentAmountForBalance,
  pipelineTransition,
  proposalStatusTimestamps,
} from '@/lib/business';
import {
  type EntityName,
  mutationSchema,
  parseEntityPayload,
} from '@/lib/validation';

const entityTables: Record<EntityName, typeof companies> = {
  companies,
  contacts: contacts as unknown as typeof companies,
  pipelineStages: pipelineStages as unknown as typeof companies,
  opportunities: opportunities as unknown as typeof companies,
  projects: projects as unknown as typeof companies,
  domains: domains as unknown as typeof companies,
  hostingServices: hostingServices as unknown as typeof companies,
  emailServices: emailServices as unknown as typeof companies,
  services: services as unknown as typeof companies,
  subscriptions: subscriptions as unknown as typeof companies,
  charges: charges as unknown as typeof companies,
  payments: payments as unknown as typeof companies,
  proposals: proposals as unknown as typeof companies,
  meetings: meetings as unknown as typeof companies,
  tasks: tasks as unknown as typeof companies,
  interactions: interactions as unknown as typeof companies,
  messageTemplates: messageTemplates as unknown as typeof companies,
  tags: tags as unknown as typeof companies,
};

const archiveTables: Partial<Record<EntityName, typeof companies>> = {
  companies,
  contacts: contacts as unknown as typeof companies,
  opportunities: opportunities as unknown as typeof companies,
  projects: projects as unknown as typeof companies,
  domains: domains as unknown as typeof companies,
  hostingServices: hostingServices as unknown as typeof companies,
  emailServices: emailServices as unknown as typeof companies,
  charges: charges as unknown as typeof companies,
  proposals: proposals as unknown as typeof companies,
  meetings: meetings as unknown as typeof companies,
};

async function logActivity(input: {
  ownerUserId: string;
  companyId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(activities).values({
    ownerUserId: input.ownerUserId,
    companyId: input.companyId || null,
    entityType: input.entityType,
    entityId: input.entityId || null,
    action: input.action,
    description: input.description,
    metadata: input.metadata || {},
  });
}

export async function getAppData(ownerUserId: string) {
  const active = isNull;
  const [
    companyRows,
    archivedCompanyRows,
    contactRows,
    stageRows,
    opportunityRows,
    projectRows,
    domainRows,
    hostingRows,
    emailServiceRows,
    serviceRows,
    subscriptionRows,
    chargeRows,
    paymentRows,
    proposalRows,
    meetingRows,
    taskRows,
    interactionRows,
    templateRows,
    messageLogRows,
    notificationRows,
    tagRows,
    companyTagRows,
    activityRows,
    settingRows,
  ] = await Promise.all([
    db
      .select()
      .from(companies)
      .where(
        and(
          eq(companies.ownerUserId, ownerUserId),
          active(companies.archivedAt),
        ),
      )
      .orderBy(desc(companies.updatedAt)),
    db
      .select()
      .from(companies)
      .where(
        and(
          eq(companies.ownerUserId, ownerUserId),
          isNotNull(companies.archivedAt),
        ),
      )
      .orderBy(desc(companies.archivedAt)),
    db
      .select()
      .from(contacts)
      .where(
        and(eq(contacts.ownerUserId, ownerUserId), active(contacts.archivedAt)),
      )
      .orderBy(desc(contacts.updatedAt)),
    db
      .select()
      .from(pipelineStages)
      .where(
        and(
          eq(pipelineStages.ownerUserId, ownerUserId),
          eq(pipelineStages.isActive, true),
        ),
      )
      .orderBy(pipelineStages.position),
    db
      .select()
      .from(opportunities)
      .where(
        and(
          eq(opportunities.ownerUserId, ownerUserId),
          active(opportunities.archivedAt),
        ),
      )
      .orderBy(desc(opportunities.updatedAt)),
    db
      .select()
      .from(projects)
      .where(
        and(eq(projects.ownerUserId, ownerUserId), active(projects.archivedAt)),
      )
      .orderBy(desc(projects.updatedAt)),
    db
      .select()
      .from(domains)
      .where(
        and(eq(domains.ownerUserId, ownerUserId), active(domains.archivedAt)),
      )
      .orderBy(domains.expirationDate),
    db
      .select()
      .from(hostingServices)
      .where(
        and(
          eq(hostingServices.ownerUserId, ownerUserId),
          active(hostingServices.archivedAt),
        ),
      )
      .orderBy(desc(hostingServices.updatedAt)),
    db
      .select()
      .from(emailServices)
      .where(
        and(
          eq(emailServices.ownerUserId, ownerUserId),
          active(emailServices.archivedAt),
        ),
      )
      .orderBy(desc(emailServices.updatedAt)),
    db
      .select()
      .from(services)
      .where(
        and(eq(services.ownerUserId, ownerUserId), eq(services.active, true)),
      )
      .orderBy(services.name),
    db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.ownerUserId, ownerUserId))
      .orderBy(subscriptions.nextChargeDate),
    db
      .select()
      .from(charges)
      .where(
        and(eq(charges.ownerUserId, ownerUserId), active(charges.archivedAt)),
      )
      .orderBy(desc(charges.dueDate)),
    db
      .select()
      .from(payments)
      .where(eq(payments.ownerUserId, ownerUserId))
      .orderBy(desc(payments.paidAt)),
    db
      .select()
      .from(proposals)
      .where(
        and(
          eq(proposals.ownerUserId, ownerUserId),
          active(proposals.archivedAt),
        ),
      )
      .orderBy(desc(proposals.updatedAt)),
    db
      .select()
      .from(meetings)
      .where(
        and(eq(meetings.ownerUserId, ownerUserId), active(meetings.archivedAt)),
      )
      .orderBy(meetings.meetingAt),
    db
      .select()
      .from(tasks)
      .where(eq(tasks.ownerUserId, ownerUserId))
      .orderBy(tasks.dueAt),
    db
      .select()
      .from(interactions)
      .where(eq(interactions.ownerUserId, ownerUserId))
      .orderBy(desc(interactions.occurredAt))
      .limit(500),
    db
      .select()
      .from(messageTemplates)
      .where(eq(messageTemplates.ownerUserId, ownerUserId))
      .orderBy(messageTemplates.name),
    db
      .select()
      .from(messageLogs)
      .where(eq(messageLogs.ownerUserId, ownerUserId))
      .orderBy(desc(messageLogs.createdAt))
      .limit(200),
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, ownerUserId))
      .orderBy(desc(notifications.createdAt))
      .limit(200),
    db
      .select()
      .from(tags)
      .where(eq(tags.ownerUserId, ownerUserId))
      .orderBy(tags.name),
    db
      .select()
      .from(companyTags)
      .where(
        inArray(
          companyTags.companyId,
          db
            .select({ id: companies.id })
            .from(companies)
            .where(eq(companies.ownerUserId, ownerUserId)),
        ),
      ),
    db
      .select()
      .from(activities)
      .where(eq(activities.ownerUserId, ownerUserId))
      .orderBy(desc(activities.createdAt))
      .limit(500),
    db
      .select()
      .from(settings)
      .where(eq(settings.ownerUserId, ownerUserId))
      .limit(1),
  ]);

  return {
    companies: companyRows,
    archivedCompanies: archivedCompanyRows,
    contacts: contactRows,
    pipelineStages: stageRows,
    opportunities: opportunityRows,
    projects: projectRows,
    domains: domainRows,
    hostingServices: hostingRows,
    emailServices: emailServiceRows,
    services: serviceRows,
    subscriptions: subscriptionRows,
    charges: chargeRows,
    payments: paymentRows,
    proposals: proposalRows,
    meetings: meetingRows,
    tasks: taskRows,
    interactions: interactionRows,
    messageTemplates: templateRows,
    messageLogs: messageLogRows,
    notifications: notificationRows,
    tags: tagRows,
    companyTags: companyTagRows,
    activities: activityRows,
    settings: settingRows[0] || null,
  };
}

export async function mutateApp(ownerUserId: string, rawInput: unknown) {
  const input = mutationSchema.parse(rawInput);

  if (input.action === 'create') {
    const parsed = parseEntityPayload(input.entity, input.data);
    const table = entityTables[input.entity];
    const proposalDates =
      input.entity === 'proposals'
        ? proposalStatusTimestamps({
            status: (parsed as { status?: string }).status,
          })
        : {};
    const values = {
      ...parsed,
      ...proposalDates,
      ownerUserId,
      ...(input.entity === 'interactions' ? { createdBy: ownerUserId } : {}),
    } as typeof companies.$inferInsert;
    const [row] = await db
      .insert(table)
      .values(values)
      .returning({ id: table.id });
    if (
      input.entity === 'contacts' &&
      (parsed as { isPrimary?: boolean }).isPrimary
    ) {
      const companyId = (parsed as { companyId: string }).companyId;
      await db
        .update(contacts)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(
          and(
            eq(contacts.ownerUserId, ownerUserId),
            eq(contacts.companyId, companyId),
            sql`${contacts.id} <> ${row.id}`,
          ),
        );
    }
    if (
      input.entity === 'subscriptions' &&
      (parsed as { status?: string }).status === 'active'
    ) {
      await db
        .update(companies)
        .set({
          relationshipStatus: 'active_recurring',
          lifecycleStatus: 'client',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(companies.id, (parsed as { companyId: string }).companyId),
            eq(companies.ownerUserId, ownerUserId),
          ),
        );
    }
    if (input.entity === 'interactions') {
      const interaction = parsed as {
        companyId: string;
        occurredAt?: Date | null;
        nextAction?: string | null;
        nextActionAt?: Date | null;
      };
      const [company] = await db
        .select()
        .from(companies)
        .where(
          and(
            eq(companies.id, interaction.companyId),
            eq(companies.ownerUserId, ownerUserId),
          ),
        )
        .limit(1);
      const occurredAt = interaction.occurredAt || new Date();
      const occurredDate = occurredAt.toISOString().slice(0, 10);
      const nextContactAt = company?.contactFrequencyMonths
        ? dateAtNoon(
            nextPostSaleDate(occurredDate, company.contactFrequencyMonths),
          )
        : company?.nextContactAt;
      await db
        .update(companies)
        .set({
          lastContactAt: occurredAt,
          nextContactAt,
          nextAction: interaction.nextAction || company?.nextAction,
          nextActionAt: interaction.nextActionAt || company?.nextActionAt,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(companies.id, interaction.companyId),
            eq(companies.ownerUserId, ownerUserId),
          ),
        );
      if (interaction.nextAction && interaction.nextActionAt)
        await db.insert(tasks).values({
          ownerUserId,
          companyId: interaction.companyId,
          title: interaction.nextAction,
          type: 'follow_up',
          dueAt: interaction.nextActionAt,
          source: 'manual',
        });
    }
    const companyId =
      'companyId' in parsed && typeof parsed.companyId === 'string'
        ? parsed.companyId
        : input.entity === 'companies'
          ? row.id
          : null;
    await logActivity({
      ownerUserId,
      companyId,
      entityType: input.entity,
      entityId: row.id,
      action: 'created',
      description: `${input.entity} criado.`,
    });
    return row;
  }

  if (input.action === 'update') {
    const parsed = parseEntityPayload(input.entity, input.data, true);
    const table = entityTables[input.entity];
    const [existing] = await db
      .select()
      .from(table)
      .where(and(eq(table.id, input.id), eq(table.ownerUserId, ownerUserId)))
      .limit(1);
    if (!existing) throw new Error('Registro não encontrado.');
    const proposalDates =
      input.entity === 'proposals'
        ? proposalStatusTimestamps({
            status: (parsed as { status?: string }).status,
            existing: existing as unknown as {
              sentAt?: Date | null;
              acceptedAt?: Date | null;
              rejectedAt?: Date | null;
            },
          })
        : {};
    const set = {
      ...parsed,
      ...proposalDates,
      ...(Object.prototype.hasOwnProperty.call(table, 'updatedAt')
        ? { updatedAt: new Date() }
        : {}),
    } as Partial<typeof companies.$inferInsert>;
    const [row] = await db
      .update(table)
      .set(set)
      .where(and(eq(table.id, input.id), eq(table.ownerUserId, ownerUserId)))
      .returning({ id: table.id });
    if (!row) throw new Error('Registro não encontrado.');
    if (
      input.entity === 'contacts' &&
      (parsed as { isPrimary?: boolean }).isPrimary
    ) {
      const [contact] = await db
        .select({ companyId: contacts.companyId })
        .from(contacts)
        .where(
          and(eq(contacts.id, input.id), eq(contacts.ownerUserId, ownerUserId)),
        )
        .limit(1);
      if (contact)
        await db
          .update(contacts)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(
            and(
              eq(contacts.ownerUserId, ownerUserId),
              eq(contacts.companyId, contact.companyId),
              sql`${contacts.id} <> ${input.id}`,
            ),
          );
    }
    const existingCompanyId = (
      existing as unknown as { companyId?: string | null }
    ).companyId;
    const parsedCompanyId = (parsed as { companyId?: string | null }).companyId;
    const companyId =
      input.entity === 'companies'
        ? input.id
        : parsedCompanyId || existingCompanyId || null;
    await logActivity({
      ownerUserId,
      companyId,
      entityType: input.entity,
      entityId: input.id,
      action: 'updated',
      description: `${input.entity} atualizado.`,
    });
    return row;
  }

  if (input.action === 'updateSettings') {
    const [row] = await db
      .insert(settings)
      .values({ ownerUserId, ...input.data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.ownerUserId,
        set: { ...input.data, updatedAt: new Date() },
      })
      .returning({ id: settings.id });
    await logActivity({
      ownerUserId,
      entityType: 'settings',
      entityId: row.id,
      action: 'updated',
      description: 'Configurações operacionais atualizadas.',
    });
    return row;
  }

  if (input.action === 'archive' || input.action === 'restore') {
    const table = archiveTables[input.entity];
    if (!table)
      throw new Error(
        'Este tipo de registro não pode ser arquivado por esta ação.',
      );
    const [row] = await db
      .update(table)
      .set({
        archivedAt: input.action === 'archive' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(table.id, input.id), eq(table.ownerUserId, ownerUserId)))
      .returning({ id: table.id });
    if (!row) throw new Error('Registro não encontrado.');
    await logActivity({
      ownerUserId,
      entityType: input.entity,
      entityId: input.id,
      action: input.action,
      description: `${input.entity} ${input.action === 'archive' ? 'arquivado' : 'restaurado'}.`,
    });
    return row;
  }

  if (input.action === 'moveOpportunity') {
    const [stage] = await db
      .select()
      .from(pipelineStages)
      .where(
        and(
          eq(pipelineStages.id, input.pipelineStageId),
          eq(pipelineStages.ownerUserId, ownerUserId),
        ),
      )
      .limit(1);
    if (!stage) throw new Error('Etapa inválida.');
    const [opportunity] = await db
      .select()
      .from(opportunities)
      .where(
        and(
          eq(opportunities.id, input.id),
          eq(opportunities.ownerUserId, ownerUserId),
        ),
      )
      .limit(1);
    if (!opportunity) throw new Error('Oportunidade não encontrada.');
    const transition = pipelineTransition({
      isWon: stage.isWon,
      isLost: stage.isLost,
      lostReason: input.lostReason,
    });
    await db
      .update(opportunities)
      .set({
        pipelineStageId: stage.id,
        wonAt: transition.wonAt,
        lostAt: transition.lostAt,
        lostReason: transition.lostReason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(opportunities.id, input.id),
          eq(opportunities.ownerUserId, ownerUserId),
        ),
      );
    if (transition.companyLifecycle)
      await db
        .update(companies)
        .set({
          lifecycleStatus: transition.companyLifecycle,
          relationshipStatus: 'active_non_recurring',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(companies.id, opportunity.companyId),
            eq(companies.ownerUserId, ownerUserId),
          ),
        );
    await logActivity({
      ownerUserId,
      companyId: opportunity.companyId,
      entityType: 'opportunity',
      entityId: input.id,
      action: stage.isWon ? 'won' : stage.isLost ? 'lost' : 'stage_changed',
      description: `Oportunidade movida para ${stage.name}.`,
      metadata: { stageId: stage.id, stage: stage.slug },
    });
    return { id: input.id };
  }

  if (input.action === 'markPaid') {
    const [charge] = await db
      .select()
      .from(charges)
      .where(
        and(eq(charges.id, input.id), eq(charges.ownerUserId, ownerUserId)),
      )
      .limit(1);
    if (!charge) throw new Error('Cobrança não encontrada.');
    if (charge.status === 'cancelled')
      throw new Error('Cobrança cancelada não pode ser paga.');
    const existingTotals = await db
      .select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` })
      .from(payments)
      .where(
        and(
          eq(payments.chargeId, charge.id),
          eq(payments.ownerUserId, ownerUserId),
        ),
      );
    const amount = paymentAmountForBalance({
      chargeAmount: charge.amount,
      alreadyPaid: existingTotals[0]?.total || '0',
      requestedAmount: input.amount,
    });
    const [payment] = await db
      .insert(payments)
      .values({
        ownerUserId,
        chargeId: charge.id,
        amount,
        paidAt: new Date(),
        paymentMethod: input.paymentMethod || null,
        reference: input.reference || null,
      })
      .returning({ id: payments.id });
    const totals = await db
      .select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` })
      .from(payments)
      .where(
        and(
          eq(payments.chargeId, charge.id),
          eq(payments.ownerUserId, ownerUserId),
        ),
      );
    if (Number(totals[0]?.total || 0) >= Number(charge.amount))
      await db
        .update(charges)
        .set({ status: 'paid', updatedAt: new Date() })
        .where(
          and(eq(charges.id, charge.id), eq(charges.ownerUserId, ownerUserId)),
        );
    await logActivity({
      ownerUserId,
      companyId: charge.companyId,
      entityType: 'payment',
      entityId: payment.id,
      action: 'received',
      description: `Pagamento recebido para ${charge.description}.`,
      metadata: { chargeId: charge.id, amount },
    });
    return payment;
  }

  if (input.action === 'completeTask') {
    const [task] = await db
      .update(tasks)
      .set({
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, input.id), eq(tasks.ownerUserId, ownerUserId)))
      .returning();
    if (!task) throw new Error('Tarefa não encontrada.');
    if (input.nextAction) {
      const requestedDueAt = input.nextAction.dueAt;
      const dueAt =
        requestedDueAt instanceof Date
          ? requestedDueAt
          : requestedDueAt
            ? new Date(requestedDueAt)
            : new Date();
      await db.insert(tasks).values({
        ownerUserId,
        companyId: task.companyId,
        opportunityId: task.opportunityId,
        title: input.nextAction.title,
        type: task.type,
        dueAt,
        priority: task.priority,
        source: 'manual',
      });
    }
    await logActivity({
      ownerUserId,
      companyId: task.companyId,
      entityType: 'task',
      entityId: task.id,
      action: 'completed',
      description: `Tarefa concluída: ${task.title}.`,
    });
    return { id: task.id };
  }

  if (input.action === 'snoozeTask') {
    const until =
      input.until instanceof Date
        ? input.until
        : new Date(input.until as string);
    const [row] = await db
      .update(tasks)
      .set({
        status: 'snoozed',
        snoozedUntil: until,
        dueAt: until,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, input.id), eq(tasks.ownerUserId, ownerUserId)))
      .returning({ id: tasks.id });
    if (!row) throw new Error('Tarefa não encontrada.');
    return row;
  }

  if (input.action === 'cancelTask') {
    const [row] = await db
      .update(tasks)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(eq(tasks.id, input.id), eq(tasks.ownerUserId, ownerUserId)))
      .returning({ id: tasks.id });
    if (!row) throw new Error('Tarefa não encontrada.');
    return row;
  }

  if (input.action === 'markNotificationRead') {
    const condition = input.all
      ? eq(notifications.userId, ownerUserId)
      : and(
          eq(notifications.userId, ownerUserId),
          eq(notifications.id, input.id!),
        );
    await db.update(notifications).set({ readAt: new Date() }).where(condition);
    return { ok: true };
  }

  if (input.action === 'addCompanyTag' || input.action === 'removeCompanyTag') {
    const [company, tag] = await Promise.all([
      db
        .select({ id: companies.id })
        .from(companies)
        .where(
          and(
            eq(companies.id, input.companyId),
            eq(companies.ownerUserId, ownerUserId),
          ),
        )
        .limit(1),
      db
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.id, input.tagId), eq(tags.ownerUserId, ownerUserId)))
        .limit(1),
    ]);
    if (!company[0] || !tag[0]) throw new Error('Empresa ou tag inválida.');
    if (input.action === 'addCompanyTag')
      await db
        .insert(companyTags)
        .values({ companyId: input.companyId, tagId: input.tagId })
        .onConflictDoNothing();
    else
      await db
        .delete(companyTags)
        .where(
          and(
            eq(companyTags.companyId, input.companyId),
            eq(companyTags.tagId, input.tagId),
          ),
        );
    return { ok: true };
  }

  throw new Error('Ação não suportada.');
}
