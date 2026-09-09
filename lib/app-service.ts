import { createHash, randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  activities,
  charges,
  companies,
  companyTags,
  contacts,
  digitalAnalyses,
  domains,
  emailServices,
  hostingServices,
  interactions,
  leadScoreRules,
  meetings,
  messageLogs,
  messageTemplates,
  notifications,
  opportunities,
  payments,
  pipelineHistory,
  pipelineStages,
  projects,
  proposals,
  prospectingBatches,
  prospectingCandidates,
  referrals,
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
  isoDateInTimeZone,
} from '@/lib/business';
import {
  calculateLeadScore,
  DEFAULT_LEAD_SCORE_RULES,
  leadScoreLevel,
} from '@/lib/crm';
import { conversionFields, nextPostSaleAt } from '@/lib/customer-experience';
import {
  type EntityName,
  mutationSchema,
  parseEntityPayload,
} from '@/lib/validation';

const entityTables: Record<EntityName, typeof companies> = {
  companies,
  digitalAnalyses: digitalAnalyses as unknown as typeof companies,
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
  proposals: proposals as unknown as typeof companies,
  meetings: meetings as unknown as typeof companies,
  tasks: tasks as unknown as typeof companies,
  interactions: interactions as unknown as typeof companies,
  referrals: referrals as unknown as typeof companies,
  prospectingBatches: prospectingBatches as unknown as typeof companies,
  prospectingCandidates: prospectingCandidates as unknown as typeof companies,
  leadScoreRules: leadScoreRules as unknown as typeof companies,
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
  await activityStatement(input);
}

function activityStatement(input: {
  ownerUserId: string;
  companyId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  return db.insert(activities).values({
    ownerUserId: input.ownerUserId,
    companyId: input.companyId || null,
    entityType: input.entityType,
    entityId: input.entityId || null,
    action: input.action,
    description: input.description,
    metadata: input.metadata || {},
  });
}

async function ownedCompany(ownerUserId: string, companyId: string) {
  const [company] = await db
    .select()
    .from(companies)
    .where(
      and(eq(companies.id, companyId), eq(companies.ownerUserId, ownerUserId)),
    )
    .limit(1);
  if (!company) throw new Error('Empresa vinculada não encontrada.');
  return company;
}

async function validateOwnedRelations(
  ownerUserId: string,
  parsed: Record<string, unknown>,
) {
  const relations: Array<[keyof typeof parsed, typeof companies, string]> = [
    ['referredByCompanyId', companies, 'Empresa indicadora'],
    [
      'pipelineStageId',
      pipelineStages as unknown as typeof companies,
      'Etapa do pipeline',
    ],
    ['projectId', projects as unknown as typeof companies, 'Projeto'],
    ['serviceId', services as unknown as typeof companies, 'Serviço'],
    [
      'subscriptionId',
      subscriptions as unknown as typeof companies,
      'Assinatura',
    ],
    [
      'opportunityId',
      opportunities as unknown as typeof companies,
      'Oportunidade',
    ],
    ['chargeId', charges as unknown as typeof companies, 'Cobrança'],
    ['domainId', domains as unknown as typeof companies, 'Domínio'],
    ['meetingId', meetings as unknown as typeof companies, 'Reunião'],
    [
      'batchId',
      prospectingBatches as unknown as typeof companies,
      'Lote de prospecção',
    ],
  ];
  for (const [key, table, label] of relations) {
    const relationId = parsed[key];
    if (typeof relationId !== 'string') continue;
    const [row] = await db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.id, relationId), eq(table.ownerUserId, ownerUserId)))
      .limit(1);
    if (!row) throw new Error(`${label} vinculado não encontrado.`);
  }
  const responsibleUserId = parsed.responsibleUserId;
  if (
    typeof responsibleUserId === 'string' &&
    responsibleUserId !== ownerUserId
  )
    throw new Error('Responsável inválido para esta operação.');
}

async function scoreAnalysis(
  ownerUserId: string,
  companyId: string,
  analysis: Parameters<typeof calculateLeadScore>[1],
) {
  const [company, customRules] = await Promise.all([
    ownedCompany(ownerUserId, companyId),
    db
      .select()
      .from(leadScoreRules)
      .where(eq(leadScoreRules.ownerUserId, ownerUserId)),
  ]);
  const override = (analysis as { scoreOverride?: number | null })
    .scoreOverride;
  if (override !== null && override !== undefined) {
    return {
      score: override,
      level: leadScoreLevel(override),
      breakdown: [
        {
          ruleKey: 'manual_override',
          label: 'Pontuação informada manualmente',
          points: override,
        },
      ],
    };
  }
  return calculateLeadScore(
    company,
    analysis,
    customRules.length ? customRules : DEFAULT_LEAD_SCORE_RULES,
  );
}

async function recalculateOwnerScores(ownerUserId: string, companyId?: string) {
  const [companyRows, analysisRows, customRules] = await Promise.all([
    db
      .select()
      .from(companies)
      .where(
        companyId
          ? and(
              eq(companies.ownerUserId, ownerUserId),
              eq(companies.id, companyId),
            )
          : eq(companies.ownerUserId, ownerUserId),
      ),
    db
      .select()
      .from(digitalAnalyses)
      .where(
        companyId
          ? and(
              eq(digitalAnalyses.ownerUserId, ownerUserId),
              eq(digitalAnalyses.companyId, companyId),
            )
          : eq(digitalAnalyses.ownerUserId, ownerUserId),
      ),
    db
      .select()
      .from(leadScoreRules)
      .where(eq(leadScoreRules.ownerUserId, ownerUserId)),
  ]);
  const companyMap = new Map(companyRows.map((row) => [row.id, row]));
  for (const analysis of analysisRows) {
    const company = companyMap.get(analysis.companyId);
    if (!company) continue;
    const score =
      analysis.scoreOverride === null
        ? calculateLeadScore(
            company,
            analysis,
            customRules.length ? customRules : DEFAULT_LEAD_SCORE_RULES,
          )
        : {
            score: analysis.scoreOverride,
            level: leadScoreLevel(analysis.scoreOverride),
            breakdown: [
              {
                ruleKey: 'manual_override',
                label: 'Pontuação informada manualmente',
                points: analysis.scoreOverride,
              },
            ],
          };
    await db
      .update(digitalAnalyses)
      .set({
        leadScore: score.score,
        scoreLevel: score.level,
        scoreBreakdown: score.breakdown,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(digitalAnalyses.id, analysis.id),
          eq(digitalAnalyses.ownerUserId, ownerUserId),
        ),
      );
  }
}

export async function getAppData(ownerUserId: string) {
  const active = isNull;
  const [
    companyRows,
    archivedCompanyRows,
    contactRows,
    digitalAnalysisRows,
    stageRows,
    opportunityRows,
    pipelineHistoryRows,
    referralRows,
    prospectingBatchRows,
    prospectingCandidateRows,
    leadScoreRuleRows,
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
      .from(digitalAnalyses)
      .where(eq(digitalAnalyses.ownerUserId, ownerUserId))
      .orderBy(desc(digitalAnalyses.leadScore)),
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
      .from(pipelineHistory)
      .where(eq(pipelineHistory.ownerUserId, ownerUserId))
      .orderBy(desc(pipelineHistory.changedAt))
      .limit(500),
    db
      .select()
      .from(referrals)
      .where(eq(referrals.ownerUserId, ownerUserId))
      .orderBy(desc(referrals.createdAt)),
    db
      .select()
      .from(prospectingBatches)
      .where(eq(prospectingBatches.ownerUserId, ownerUserId))
      .orderBy(desc(prospectingBatches.updatedAt)),
    db
      .select()
      .from(prospectingCandidates)
      .where(eq(prospectingCandidates.ownerUserId, ownerUserId))
      .orderBy(
        desc(prospectingCandidates.score),
        desc(prospectingCandidates.updatedAt),
      ),
    db
      .select()
      .from(leadScoreRules)
      .where(eq(leadScoreRules.ownerUserId, ownerUserId))
      .orderBy(leadScoreRules.position),
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
    digitalAnalyses: digitalAnalysisRows,
    pipelineStages: stageRows,
    opportunities: opportunityRows,
    pipelineHistory: pipelineHistoryRows,
    referrals: referralRows,
    prospectingBatches: prospectingBatchRows,
    prospectingCandidates: prospectingCandidateRows,
    leadScoreRules: leadScoreRuleRows,
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
    await validateOwnedRelations(
      ownerUserId,
      parsed as Record<string, unknown>,
    );
    const linkedCompanyId = (parsed as { companyId?: string | null }).companyId;
    if (linkedCompanyId) await ownedCompany(ownerUserId, linkedCompanyId);
    if (input.entity === 'referrals') {
      const referral = parsed as {
        referrerCompanyId: string;
        referredCompanyId: string;
      };
      await Promise.all([
        ownedCompany(ownerUserId, referral.referrerCompanyId),
        ownedCompany(ownerUserId, referral.referredCompanyId),
      ]);
    }
    const table = entityTables[input.entity];
    const proposalDates =
      input.entity === 'proposals'
        ? proposalStatusTimestamps({
            status: (parsed as { status?: string }).status,
          })
        : {};
    const analysisScore =
      input.entity === 'digitalAnalyses'
        ? await scoreAnalysis(
            ownerUserId,
            (parsed as { companyId: string }).companyId,
            parsed as Parameters<typeof calculateLeadScore>[1],
          )
        : null;
    const values = {
      ...parsed,
      ...proposalDates,
      ...(analysisScore
        ? {
            leadScore: analysisScore.score,
            scoreLevel: analysisScore.level,
            scoreBreakdown: analysisScore.breakdown,
            analyzedAt: new Date(),
          }
        : {}),
      ...(input.entity === 'referrals' &&
      (parsed as { status?: string }).status === 'CONVERTIDO'
        ? { convertedAt: new Date() }
        : {}),
      ownerUserId,
      ...(input.entity === 'prospectingCandidates'
        ? {
            sourceFingerprint: createHash('sha256')
              .update(
                JSON.stringify({
                  name: String(
                    (parsed as { companyName?: string }).companyName || '',
                  )
                    .trim()
                    .toLocaleLowerCase('pt-BR'),
                  city: String((parsed as { city?: string }).city || '')
                    .trim()
                    .toLocaleLowerCase('pt-BR'),
                  evidence: (
                    parsed as { evidence?: Array<{ url: string }> }
                  ).evidence
                    ?.map((item) => item.url)
                    .sort(),
                }),
              )
              .digest('hex'),
            researchedAt:
              (parsed as { researchedAt?: Date | null }).researchedAt ||
              new Date(),
          }
        : {}),
      ...(input.entity === 'interactions'
        ? {
            createdBy: ownerUserId,
            responsibleUserId:
              (parsed as { responsibleUserId?: string | null })
                .responsibleUserId || ownerUserId,
          }
        : {}),
      ...(input.entity === 'tasks'
        ? {
            responsibleUserId:
              (parsed as { responsibleUserId?: string | null })
                .responsibleUserId || ownerUserId,
          }
        : {}),
    } as typeof companies.$inferInsert;

    if (input.entity === 'interactions') {
      const interaction = parsed as {
        companyId: string;
        occurredAt?: Date | null;
        nextAction?: string | null;
        nextActionAt?: Date | null;
      };
      const company = await ownedCompany(ownerUserId, interaction.companyId);
      const [ownerSettings] = await db
        .select({ recurringPostSaleDays: settings.recurringPostSaleDays })
        .from(settings)
        .where(eq(settings.ownerUserId, ownerUserId))
        .limit(1);
      const rowId = randomUUID();
      const occurredAt = interaction.occurredAt || new Date();
      const result = String(
        (parsed as { result?: string | null }).result || '',
      );
      const resultStatus: Record<string, string> = {
        NAO_RESPONDEU: 'SEM_RESPOSTA',
        RESPONDEU: 'RESPONDEU',
        INTERESSADO: 'INTERESSADO',
        SEM_INTERESSE: 'SEM_INTERESSE',
        PEDIU_RETORNO: 'FOLLOWUP_FUTURO',
        REUNIAO_MARCADA: 'REUNIAO_AGENDADA',
        PROPOSTA_SOLICITADA: 'INTERESSADO',
      };
      const suggestedAction: Record<string, string> = {
        NAO_RESPONDEU: 'Tentar contato novamente',
        PEDIU_RETORNO: 'Retomar contato',
        REUNIAO_MARCADA: 'Realizar reunião',
        PROPOSTA_SOLICITADA: 'Preparar proposta',
      };
      const effectiveNextAction =
        interaction.nextAction || suggestedAction[result] || null;
      const effectiveNextActionAt =
        interaction.nextActionAt ||
        (result === 'NAO_RESPONDEU' ? nextPostSaleAt(occurredAt, 3) : null);
      const occurredDate = occurredAt.toISOString().slice(0, 10);
      const nextContactAt =
        company.lifecycleStatus === 'client'
          ? nextPostSaleAt(
              occurredAt,
              ownerSettings?.recurringPostSaleDays || 180,
            )
          : company.contactFrequencyMonths
            ? dateAtNoon(
                nextPostSaleDate(occurredDate, company.contactFrequencyMonths),
              )
            : company.nextContactAt;
      const insertInteraction = db.insert(interactions).values({
        ...(values as unknown as typeof interactions.$inferInsert),
        id: rowId,
        occurredAt,
        nextAction: effectiveNextAction,
        nextActionAt: effectiveNextActionAt,
      });
      const updateCompany = db
        .update(companies)
        .set({
          lastContactAt: occurredAt,
          nextContactAt,
          nextAction: effectiveNextAction || company.nextAction,
          nextActionAt: effectiveNextActionAt || company.nextActionAt,
          ...(company.lifecycleStatus !== 'client' && resultStatus[result]
            ? { prospectingStatus: resultStatus[result] as never }
            : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(companies.id, interaction.companyId),
            eq(companies.ownerUserId, ownerUserId),
          ),
        );
      const activity = activityStatement({
        ownerUserId,
        companyId: interaction.companyId,
        entityType: input.entity,
        entityId: rowId,
        action: 'created',
        description: `${input.entity} criado.`,
      });
      if (effectiveNextAction && effectiveNextActionAt) {
        await db.batch([
          insertInteraction,
          updateCompany,
          db.insert(tasks).values({
            ownerUserId,
            companyId: interaction.companyId,
            title: effectiveNextAction,
            type: 'follow_up',
            dueAt: effectiveNextActionAt,
            source: 'manual',
          }),
          activity,
        ]);
      } else {
        await db.batch([insertInteraction, updateCompany, activity]);
      }
      return { id: rowId };
    }

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
    if (input.entity === 'meetings') {
      await db
        .update(companies)
        .set({ prospectingStatus: 'REUNIAO_AGENDADA', updatedAt: new Date() })
        .where(
          and(
            eq(companies.id, (parsed as { companyId: string }).companyId),
            eq(companies.ownerUserId, ownerUserId),
            inArray(companies.lifecycleStatus, ['lead', 'prospect']),
          ),
        );
    }
    if (input.entity === 'leadScoreRules')
      await recalculateOwnerScores(ownerUserId);
    const companyId =
      'companyId' in parsed && typeof parsed.companyId === 'string'
        ? parsed.companyId
        : input.entity === 'referrals'
          ? (parsed as { referredCompanyId: string }).referredCompanyId
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
    await validateOwnedRelations(
      ownerUserId,
      parsed as Record<string, unknown>,
    );
    const linkedCompanyId = (parsed as { companyId?: string | null }).companyId;
    if (linkedCompanyId) await ownedCompany(ownerUserId, linkedCompanyId);
    if (input.entity === 'referrals') {
      const referral = parsed as {
        referrerCompanyId?: string;
        referredCompanyId?: string;
      };
      if (referral.referrerCompanyId)
        await ownedCompany(ownerUserId, referral.referrerCompanyId);
      if (referral.referredCompanyId)
        await ownedCompany(ownerUserId, referral.referredCompanyId);
    }
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
    const mergedAnalysis =
      input.entity === 'digitalAnalyses'
        ? {
            ...(existing as unknown as Parameters<
              typeof calculateLeadScore
            >[1]),
            ...(parsed as Parameters<typeof calculateLeadScore>[1]),
          }
        : null;
    const analysisScore = mergedAnalysis
      ? await scoreAnalysis(
          ownerUserId,
          (existing as unknown as { companyId: string }).companyId,
          mergedAnalysis,
        )
      : null;
    const set = {
      ...parsed,
      ...(input.entity === 'companies'
        ? conversionFields(
            String(
              (parsed as { prospectingStatus?: string }).prospectingStatus,
            ),
          )
        : {}),
      ...proposalDates,
      ...(analysisScore
        ? {
            leadScore: analysisScore.score,
            scoreLevel: analysisScore.level,
            scoreBreakdown: analysisScore.breakdown,
            analyzedAt: new Date(),
          }
        : {}),
      ...(input.entity === 'referrals' &&
      (parsed as { status?: string }).status === 'CONVERTIDO'
        ? {
            convertedAt:
              (existing as unknown as { convertedAt?: Date | null })
                .convertedAt || new Date(),
          }
        : {}),
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
    if (input.entity === 'leadScoreRules')
      await recalculateOwnerScores(ownerUserId);
    if (input.entity === 'companies')
      await recalculateOwnerScores(ownerUserId, input.id);
    if (
      input.entity === 'domains' &&
      Object.prototype.hasOwnProperty.call(parsed, 'expirationDate') &&
      (existing as unknown as { expirationDate?: string }).expirationDate !==
        (parsed as { expirationDate?: string }).expirationDate
    ) {
      await db
        .update(tasks)
        .set({
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tasks.ownerUserId, ownerUserId),
            eq(tasks.domainId, input.id),
            inArray(tasks.status, ['open', 'snoozed']),
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
        : input.entity === 'referrals'
          ? (parsed as { referredCompanyId?: string }).referredCompanyId ||
            (existing as unknown as { referredCompanyId?: string })
              .referredCompanyId ||
            null
          : parsedCompanyId || existingCompanyId || null;
    await logActivity({
      ownerUserId,
      companyId,
      entityType: input.entity,
      entityId: input.id,
      action: 'updated',
      description: `${input.entity} atualizado.`,
      metadata:
        input.entity === 'companies' &&
        Object.prototype.hasOwnProperty.call(parsed, 'prospectingStatus')
          ? {
              previousProspectingStatus: (
                existing as unknown as { prospectingStatus?: string }
              ).prospectingStatus,
              prospectingStatus: (parsed as { prospectingStatus?: string })
                .prospectingStatus,
            }
          : {},
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

  if (input.action === 'promoteProspectingCandidate') {
    const [candidate] = await db
      .select()
      .from(prospectingCandidates)
      .where(
        and(
          eq(prospectingCandidates.id, input.id),
          eq(prospectingCandidates.ownerUserId, ownerUserId),
        ),
      )
      .limit(1);
    if (!candidate) throw new Error('Candidato não encontrado.');
    if (candidate.promotedCompanyId)
      return { id: candidate.promotedCompanyId, candidateId: candidate.id };

    const existingCompanies = await db
      .select({ id: companies.id, name: companies.name, city: companies.city })
      .from(companies)
      .where(eq(companies.ownerUserId, ownerUserId));
    const normalizedName = candidate.companyName
      .trim()
      .toLocaleLowerCase('pt-BR');
    const normalizedCity = (candidate.city || '')
      .trim()
      .toLocaleLowerCase('pt-BR');
    const duplicate = existingCompanies.find(
      (company) =>
        company.name.trim().toLocaleLowerCase('pt-BR') === normalizedName &&
        (company.city || '').trim().toLocaleLowerCase('pt-BR') ===
          normalizedCity,
    );
    if (duplicate)
      throw new Error(
        'Já existe uma empresa com este nome e cidade. Revise o cadastro existente.',
      );

    const companyId = randomUUID();
    const analysisId = randomUUID();
    await db.batch([
      db.insert(companies).values({
        id: companyId,
        ownerUserId,
        name: candidate.companyName,
        website: candidate.website,
        instagram: candidate.instagram,
        email: candidate.publicEmail,
        phone: candidate.publicPhone,
        whatsapp: candidate.publicPhone,
        city: candidate.city,
        state: candidate.state,
        industry: candidate.industry,
        lifecycleStatus: 'lead',
        relationshipStatus: 'inactive',
        prospectingStatus: 'NOVO_LEAD',
        leadSource: 'Lote de prospecção',
        sourceUrl: candidate.evidence[0]?.url || null,
        notesSummary: candidate.observations,
      }),
      db.insert(digitalAnalyses).values({
        id: analysisId,
        ownerUserId,
        companyId,
        hasSite: candidate.hasSite,
        websiteUrl: candidate.website,
        siteStatus: candidate.siteStatus,
        leadScore: candidate.score,
        scoreOverride: candidate.score,
        scoreLevel: leadScoreLevel(candidate.score),
        priority: leadScoreLevel(candidate.score),
        scoreBreakdown: candidate.scoreReasons.map((reason) => ({
          ruleKey: 'prospecting_research',
          label: reason,
          points: 0,
        })),
        issues: candidate.digitalPresence,
        opportunities: candidate.observations,
        analyzedAt: candidate.researchedAt || new Date(),
      }),
      db
        .update(prospectingCandidates)
        .set({
          status: 'promoted',
          promotedCompanyId: companyId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(prospectingCandidates.id, candidate.id),
            eq(prospectingCandidates.ownerUserId, ownerUserId),
          ),
        ),
      activityStatement({
        ownerUserId,
        companyId,
        entityType: 'prospecting_candidate',
        entityId: candidate.id,
        action: 'promoted',
        description: `Candidato promovido para lead: ${candidate.companyName}.`,
        metadata: { batchId: candidate.batchId, analysisId },
      }),
    ]);
    return { id: companyId, candidateId: candidate.id };
  }

  if (input.action === 'createLegacyClient') {
    const value = input.data;
    const normalizedName = value.companyName.trim().toLocaleLowerCase('pt-BR');
    const allCompanies = await db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(eq(companies.ownerUserId, ownerUserId));
    if (
      allCompanies.some(
        (company) =>
          company.name.trim().toLocaleLowerCase('pt-BR') === normalizedName,
      )
    )
      throw new Error('Já existe uma empresa com este nome.');

    const companyId = randomUUID();
    const projectId = randomUUID();
    const today = isoDateInTimeZone();
    const [ownerSettings] = await db
      .select({ firstPostSaleDays: settings.firstPostSaleDays })
      .from(settings)
      .where(eq(settings.ownerUserId, ownerUserId))
      .limit(1);
    const deliveryDate = value.deliveryDate || null;
    const explicitPostSaleDate = value.postSaleDate
      ? value.postSaleDate instanceof Date
        ? new Date(value.postSaleDate.getTime())
        : new Date(value.postSaleDate)
      : null;
    const lastContactAt = value.lastContactAt
      ? value.lastContactAt instanceof Date
        ? new Date(value.lastContactAt.getTime())
        : new Date(value.lastContactAt)
      : null;
    const postSaleDate: Date | null =
      explicitPostSaleDate ||
      (deliveryDate
        ? dateAtNoon(
            new Date(`${deliveryDate}T12:00:00Z`).toISOString().slice(0, 10),
          )
        : null);
    if (postSaleDate && !explicitPostSaleDate)
      postSaleDate.setUTCDate(
        postSaleDate.getUTCDate() + (ownerSettings?.firstPostSaleDays || 90),
      );

    const statements = [
      db.insert(companies).values({
        id: companyId,
        ownerUserId,
        name: value.companyName,
        primaryContactName: value.primaryContactName,
        industry: value.industry,
        city: value.city,
        state: value.state,
        website: value.website,
        email: value.email,
        phone: value.phone,
        whatsapp: value.whatsapp,
        lifecycleStatus: 'client',
        relationshipStatus: value.hasMaintenance
          ? 'active_recurring'
          : 'active_non_recurring',
        prospectingStatus: 'FECHADO',
        lastContactAt,
        nextContactAt: postSaleDate,
        notesSummary: value.notes,
      }),
      db.insert(projects).values({
        id: projectId,
        ownerUserId,
        companyId,
        name: value.projectName,
        type: value.projectType,
        status: 'delivered',
        productionUrl: value.productionUrl,
        startDate: value.projectStartDate,
        deliveryDate,
        soldValue: value.soldValue || '0.00',
        notes: value.notes,
      }),
      activityStatement({
        ownerUserId,
        companyId,
        entityType: 'company',
        entityId: companyId,
        action: 'legacy_client_created',
        description: `Cliente antigo cadastrado com projeto entregue: ${value.companyName}.`,
      }),
    ];
    if (value.domain && value.domainExpirationDate)
      statements.push(
        db.insert(domains).values({
          ownerUserId,
          companyId,
          projectId,
          domain: value.domain,
          registrar: value.domainRegistrar,
          expirationDate: value.domainExpirationDate,
          responsibility: value.domainResponsibility,
          registeredUnderMyAccount: value.domainResponsibility === 'me',
        }) as never,
      );
    if (value.hostingProvider)
      statements.push(
        db.insert(hostingServices).values({
          ownerUserId,
          companyId,
          projectId,
          provider: value.hostingProvider,
          plan: value.hostingPlan,
          renewalDate: value.hostingRenewalDate,
        }) as never,
      );
    if (value.hasMaintenance && value.maintenanceAmount) {
      const startDate = value.maintenanceStartDate || today;
      statements.push(
        db.insert(subscriptions).values({
          ownerUserId,
          companyId,
          projectId,
          description: value.maintenanceDescription || 'Manutenção mensal',
          amount: value.maintenanceAmount,
          frequency: 'monthly',
          billingDay: Number(startDate.slice(8, 10)),
          startDate,
          nextChargeDate: startDate,
          status: 'active',
        }) as never,
      );
    }
    await db.batch(statements as never);
    return { id: companyId, projectId };
  }

  if (input.action === 'archive' || input.action === 'restore') {
    const table = archiveTables[input.entity];
    if (!table)
      throw new Error(
        'Este tipo de registro não pode ser arquivado por esta ação.',
      );
    const [existing] = await db
      .select()
      .from(table)
      .where(and(eq(table.id, input.id), eq(table.ownerUserId, ownerUserId)))
      .limit(1);
    if (!existing) throw new Error('Registro não encontrado.');
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
      companyId:
        input.entity === 'companies'
          ? input.id
          : (existing as unknown as { companyId?: string | null }).companyId ||
            null,
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
    const updateOpportunity = db
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
    const insertHistory = db.insert(pipelineHistory).values({
      ownerUserId,
      companyId: opportunity.companyId,
      opportunityId: opportunity.id,
      fromStageId: opportunity.pipelineStageId,
      toStageId: stage.id,
      reason: input.lostReason || null,
      changedBy: ownerUserId,
    });
    const activity = activityStatement({
      ownerUserId,
      companyId: opportunity.companyId,
      entityType: 'opportunity',
      entityId: input.id,
      action: stage.isWon ? 'won' : stage.isLost ? 'lost' : 'stage_changed',
      description: `Oportunidade movida para ${stage.name}.`,
      metadata: { stageId: stage.id, stage: stage.slug },
    });
    if (transition.companyLifecycle) {
      await db.batch([
        updateOpportunity,
        insertHistory,
        db
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
          ),
        activity,
      ]);
    } else {
      await db.batch([updateOpportunity, insertHistory, activity]);
    }
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
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, input.id), eq(tasks.ownerUserId, ownerUserId)))
      .limit(1);
    if (!task) throw new Error('Tarefa não encontrada.');
    const now = new Date();
    const completeTask = db
      .update(tasks)
      .set({ status: 'completed', completedAt: now, updatedAt: now })
      .where(and(eq(tasks.id, input.id), eq(tasks.ownerUserId, ownerUserId)));
    const activity = activityStatement({
      ownerUserId,
      companyId: task.companyId,
      entityType: 'task',
      entityId: task.id,
      action: 'completed',
      description: `Tarefa concluída: ${task.title}.`,
    });
    if (input.nextAction) {
      const requestedDueAt = input.nextAction.dueAt;
      const dueAt =
        requestedDueAt instanceof Date
          ? requestedDueAt
          : requestedDueAt
            ? new Date(requestedDueAt)
            : new Date();
      await db.batch([
        completeTask,
        db.insert(tasks).values({
          ownerUserId,
          companyId: task.companyId,
          opportunityId: task.opportunityId,
          title: input.nextAction.title,
          type: task.type,
          dueAt,
          priority: task.priority,
          source: 'manual',
        }),
        activity,
      ]);
    } else {
      await db.batch([completeTask, activity]);
    }
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
