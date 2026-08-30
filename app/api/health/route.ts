import { sql } from 'drizzle-orm';
import { db } from '@/db';

export const dynamic = 'force-dynamic';

const noStoreHeaders = { 'Cache-Control': 'no-store' };

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: 'ok', database: 'ok' }, { headers: noStoreHeaders });
  } catch (error) {
    console.error('Falha no health check do banco de dados.', error);
    return Response.json(
      { status: 'degraded', database: 'error' },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
