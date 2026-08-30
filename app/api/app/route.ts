import { ZodError } from 'zod';
import { getAppData, mutateApp } from '@/lib/app-service';
import { requireUser } from '@/lib/require-user';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();
    const data = await getAppData(user.id);
    const companyById = new Map(data.companies.map((company) => [company.id, company]));
    const stageById = new Map(data.pipelineStages.map((stage) => [stage.id, stage]));
    const primaryContactByCompany = new Map(data.contacts.filter((contact) => contact.isPrimary).map((contact) => [contact.companyId, contact]));
    const firstContactByCompany = new Map(data.contacts.map((contact) => [contact.companyId, contact]));
    const contactFor = (companyId: string) => primaryContactByCompany.get(companyId) || firstContactByCompany.get(companyId);
    return Response.json({
      user: { ...user, mustChangePassword: false },
      ...data,
      companies: data.companies.map((company) => ({ ...company, lifecycle: company.lifecycleStatus, clientStatus: company.relationshipStatus, segment: company.industry, health: company.healthStatus, contactName: contactFor(company.id)?.name, contactEmail: contactFor(company.id)?.email, whatsapp: contactFor(company.id)?.whatsapp || company.whatsapp })),
      projects: data.projects.map((project) => ({ ...project, companyName: companyById.get(project.companyId)?.name || '', soldValue: Number(project.soldValue) })),
      domains: data.domains.map((domain) => ({ ...domain, companyName: companyById.get(domain.companyId)?.name || '', expiresAt: domain.expirationDate, registeredInMyName: domain.registeredUnderMyAccount ? 1 : 0, renewalPrice: Number(domain.clientRenewalPrice) })),
      opportunities: data.opportunities.map((opportunity) => ({ ...opportunity, companyName: companyById.get(opportunity.companyId)?.name || '', stage: stageById.get(opportunity.pipelineStageId)?.slug || '', value: Number(opportunity.estimatedValue), nextFollowUpAt: opportunity.nextActionAt })),
      charges: data.charges.map((charge) => ({ ...charge, companyName: companyById.get(charge.companyId)?.name || '', contactName: contactFor(charge.companyId)?.name, whatsapp: contactFor(charge.companyId)?.whatsapp || companyById.get(charge.companyId)?.whatsapp, value: Number(charge.amount), dueAt: charge.dueDate, paidAt: data.payments.find((payment) => payment.chargeId === charge.id)?.paidAt, recurring: charge.subscriptionId ? 1 : 0, recurrenceMonths: 1 })),
      tasks: data.tasks.map((task) => ({ ...task, companyName: task.companyId ? companyById.get(task.companyId)?.name : undefined, category: task.type })),
      templates: data.messageTemplates,
      activities: data.activities.map((activity) => ({ ...activity, companyName: activity.companyId ? companyById.get(activity.companyId)?.name : undefined })),
    });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === 'UNAUTHORIZED';
    return Response.json({ error: unauthorized ? 'Não autorizado.' : 'Não foi possível carregar os dados.' }, { status: unauthorized ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    return Response.json(await mutateApp(user.id, await request.json()));
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return Response.json({ error: 'Não autorizado.' }, { status: 401 });
    const message = error instanceof ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : 'Não foi possível concluir a ação.';
    return Response.json({ error: message }, { status: 400 });
  }
}
