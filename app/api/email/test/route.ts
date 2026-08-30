import { db } from '@/db';
import { messageLogs } from '@/db/schema';
import { operationalEmail } from '@/lib/email-templates';
import { sendEmail } from '@/lib/email';
import { requireUser } from '@/lib/require-user';

export const dynamic = 'force-dynamic';

const subject = '[Teste] Minha Operação';

export async function POST() {
  try {
    const user = await requireUser();
    const message = operationalEmail({
      title: subject,
      content: 'A configuração de e-mail do sistema está funcionando corretamente.',
    });

    try {
      const result = await sendEmail({
        to: user.email,
        subject,
        html: message.html,
        idempotencyKey: `email-configuration-test-${crypto.randomUUID()}`,
      });
      const [log] = await db.insert(messageLogs).values({
        ownerUserId: user.id,
        channel: 'email',
        recipient: user.email,
        subject,
        provider: 'resend',
        providerMessageId: result?.id || null,
        status: 'sent',
        sentAt: new Date(),
      }).returning({ id: messageLogs.id });
      return Response.json({ ok: true, logId: log.id });
    } catch (error) {
      await db.insert(messageLogs).values({
        ownerUserId: user.id,
        channel: 'email',
        recipient: user.email,
        subject,
        provider: 'resend',
        status: 'failed',
        errorMessage: error instanceof Error ? error.message.slice(0, 1_000) : 'Falha no envio',
      });
      console.error('Falha ao enviar o e-mail de teste.', error);
      return Response.json({ error: 'Não foi possível enviar o e-mail de teste. Verifique a configuração do Resend.' }, { status: 502 });
    }
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === 'UNAUTHORIZED';
    return Response.json(
      { error: unauthorized ? 'Não autorizado.' : 'Não foi possível validar a configuração de e-mail.' },
      { status: unauthorized ? 401 : 500 },
    );
  }
}
