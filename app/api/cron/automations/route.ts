import { timingSafeEqual } from 'node:crypto';
import { runAutomations } from '@/lib/automation-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization') || '';
  if (!secret) return Response.json({ error: 'CRON_SECRET não configurado.' }, { status: 503 });
  if (!secureEqual(authorization, `Bearer ${secret}`)) return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  try {
    return Response.json({ ok: true, ...(await runAutomations()) });
  } catch {
    return Response.json({ error: 'Falha ao processar automações.' }, { status: 500 });
  }
}
