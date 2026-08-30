import { z } from 'zod';
import { db } from '@/db';
import { companies, messageLogs, messageTemplates } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { sendEmail } from '@/lib/email';
import { operationalEmail, renderTemplate } from '@/lib/email-templates';
import { requireUser } from '@/lib/require-user';

const sendSchema = z.object({
  companyId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  to: z.string().email(),
  subject: z.string().trim().min(1).max(300),
  content: z.string().trim().min(1).max(20_000),
  variables: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = sendSchema.parse(await request.json());
    if (input.companyId) {
      const [company] = await db.select({ id: companies.id }).from(companies).where(and(eq(companies.id, input.companyId), eq(companies.ownerUserId, user.id))).limit(1);
      if (!company) throw new Error('Empresa inválida.');
    }
    if (input.templateId) {
      const [template] = await db.select({ id: messageTemplates.id }).from(messageTemplates).where(and(eq(messageTemplates.id, input.templateId), eq(messageTemplates.ownerUserId, user.id))).limit(1);
      if (!template) throw new Error('Template inválido.');
    }
    const subject = renderTemplate(input.subject, input.variables);
    const content = renderTemplate(input.content, input.variables);
    const rendered = operationalEmail({ title: subject, content });
    try {
      const result = await sendEmail({ to: input.to, subject, html: rendered.html, idempotencyKey: `message-${crypto.randomUUID()}` });
      await db.insert(messageLogs).values({ ownerUserId: user.id, companyId: input.companyId || null, templateId: input.templateId || null, channel: 'email', recipient: input.to, subject, provider: 'resend', providerMessageId: result?.id || null, status: 'sent', sentAt: new Date() });
      return Response.json({ id: result?.id });
    } catch (error) {
      await db.insert(messageLogs).values({ ownerUserId: user.id, companyId: input.companyId || null, templateId: input.templateId || null, channel: 'email', recipient: input.to, subject, provider: 'resend', status: 'failed', errorMessage: error instanceof Error ? error.message.slice(0, 1_000) : 'Falha no envio' });
      throw error;
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Não autorizado.' : error instanceof Error ? error.message : 'Não foi possível enviar.' }, { status: error instanceof Error && error.message === 'UNAUTHORIZED' ? 401 : 400 });
  }
}
